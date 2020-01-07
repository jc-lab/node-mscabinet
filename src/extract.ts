import * as streams from 'stream';
import ReadBuffer from './read-buffer';
import {ParseResult} from './internals';
import {CFHeader} from './cfheader';
import {CFFolder} from './cffolder';
import {CFFile} from './cffile';
import {CFData} from './cfdata';
import {ExtractContext} from './extract_context';

const METHOD_PARSE_HEADER = Symbol('PARSE_HEADER');
const METHOD_PARSE_FOLDERS = Symbol('PARSE_FOLDERS');
const METHOD_PARSE_HEADER_PAD = Symbol('PARSE_HEADER_PAD');
const METHOD_PARSE_FILES = Symbol('PARSE_FILES');
const METHOD_PARSE_DATAS = Symbol('PARSE_DATAS');

type ParserMethod = (chunk: ReadBuffer) => Promise<ParseResult>;

interface IProcessFileData {
    index: number;
    size: number;
    offset: number;
    nextPromise: Promise<void>;
    next: {
        resolve: () => void,
        reject: () => void
    }
}

class EntryStream extends streams.PassThrough {
    public _meta!: IProcessFileData;

    constructor() {
        super({
            autoDestroy: true
        });
    }

    async init(index: number, size: number) {
        const meta: IProcessFileData = {
            index,
            size,
            offset: 0
        } as IProcessFileData;
        this._meta = meta;
        return new Promise((resolve, reject) => {
            meta.nextPromise = new Promise<void>((next_resolve, next_reject) => {
                meta.next = {
                    resolve: next_resolve,
                    reject: next_reject
                };
                resolve();
            });
        });
    }

    public get remaining() {
        return this._meta.size - this._meta.offset;
    }

    public get meta() {
        return this._meta;
    }
}

class ExtractContextImpl extends ExtractContext {
    private _target: NodeJS.EventEmitter;
    private _cffiles: CFFile[];

    public offset: number;
    public processing: EntryStream | null = null;

    constructor(target: NodeJS.EventEmitter, folder: CFFolder, cffiles: CFFile[]) {
        super(folder);
        this._target = target;
        this._cffiles = cffiles;
        this.offset = 0;
    }

    private getNextFileIndex(prev: IProcessFileData | null): number {
        let nextIndex = prev ? (prev.index + 1) : 0;
        if(nextIndex >= this._cffiles.length) {
            return -1;
        }
        return nextIndex;
    }

    public consumeData(data: Buffer): Promise<void> {
        return new Promise<void>( async(resolve, reject) => {
            try {
                const reader = new ReadBuffer(data);
                do {
                    let prepareNext = false;
                    let currentMeta: IProcessFileData | null = null;
                    if (this.processing) {
                        const cur = this.processing;
                        const entryRemaining = cur.remaining;
                        const avail = reader.remaining < entryRemaining ? reader.remaining : entryRemaining;
                        const partial = reader.readBuffer(avail);
                        cur.push(partial);
                        cur.meta.offset += avail;
                        currentMeta = cur.meta;
                        if (cur.remaining == 0) {
                            cur.end();
                            await cur.meta.nextPromise;
                            prepareNext = true;
                        }
                    } else {
                        prepareNext = true;
                    }
                    if (prepareNext) {
                        const nextIndex = this.getNextFileIndex(currentMeta);
                        if(nextIndex < 0) {
                            break;
                        }
                        const file = this._cffiles[nextIndex];
                        const cur = this.processing = new EntryStream();
                        await this.processing.init(nextIndex, file.cbFile);
                        this._target.emit('entry', file, this.processing, () => {
                            cur.meta.next.resolve();
                        });
                    }
                } while (this.processing && (reader.remaining > 0));
                resolve();
            }catch (e) {
                reject(e);
            }
        });
    }
}

export interface IExtractListeners {
    on(event: "entry", listener: (file: CFFile, stream: streams.Readable, next: () => void) => void): this;
}

export class Extract extends streams.Writable implements IExtractListeners {
    private _destroyed: boolean = false;
    private _partial: boolean = false;

    private _totalReadBytes: number;
    private _parsers: ParserMethod[];
    private _buffer: Buffer | null;

    private _cbCabinet: number;
    private _cfheader: CFHeader;
    private _cffolders!: CFFolder[];
    private _cffiles!: CFFile[]; // Sorted list

    private _readFolderIndex: number = -1;
    private _curFolder: CFFolder | null = null;

    private _curCfData!: CFData;
    private _curExtractContext!: ExtractContextImpl;

    constructor(opts?: any) {
        super(opts);
        this._destroyed = false;
        this._partial = false;
        this._totalReadBytes = 0;
        this._cbCabinet = -1;
        this._cfheader = new CFHeader();
        this._parsers = [
            this[METHOD_PARSE_HEADER].bind(this),
            this[METHOD_PARSE_FOLDERS].bind(this),
            this[METHOD_PARSE_HEADER_PAD].bind(this),
            this[METHOD_PARSE_FILES].bind(this),
            this[METHOD_PARSE_DATAS].bind(this)
        ];
        this._buffer = null;
    }

    private async [METHOD_PARSE_HEADER](buffer: ReadBuffer): Promise<ParseResult> {
        const result = await this._cfheader.parse(buffer);
        if(result == ParseResult.DONE) {
            this._cffolders = [];
            this._cbCabinet = this._cfheader.cbCabinet;
        }
        return result;
    }

    private async [METHOD_PARSE_FOLDERS](buffer: ReadBuffer): Promise<ParseResult> {
        //TODO: Check folder's data end position (end = next_folder_header_begin)

        if(this._cfheader.cFolders == 0) {
            return Promise.resolve(ParseResult.DONE);
        }
        if(this._cffolders.length == 0) {
            this._cffolders.push(new CFFolder(this._cfheader));
        }
        const current = this._cffolders[this._cffolders.length - 1];
        const result = await current.parse(buffer);
        if(result == ParseResult.DONE) {
            if(this._cffolders.length < this._cfheader.cFolders) {
                this._cffolders.push(new CFFolder(this._cfheader));
                return Promise.resolve(ParseResult.RERUN);
            }else{
                this._cffiles = [];
            }
        }
        return result;
    }

    private async [METHOD_PARSE_HEADER_PAD](buffer: ReadBuffer): Promise<ParseResult> {
        if(this._cfheader.coffFiles != this._totalReadBytes) {
            if(this._cfheader.coffFiles > this._totalReadBytes) {
                const pad = this._cfheader.coffFiles - this._totalReadBytes;
                if (buffer.remaining < pad) {
                    return Promise.resolve(ParseResult.NEED_MORE);
                }
                buffer.readBuffer(pad);
                this._totalReadBytes += pad;
            }else{
                throw new Error('File error');
            }
        }
        return Promise.resolve(ParseResult.DONE);
    }

    private async [METHOD_PARSE_FILES](buffer: ReadBuffer): Promise<ParseResult> {
        if(this._cfheader.cFiles == 0) {
            return Promise.resolve(ParseResult.DONE);
        }
        if(this._cffiles.length == 0) {
            this._cffiles.push(new CFFile());
        }
        const current = this._cffiles[this._cffiles.length - 1];
        const result = await current.parse(buffer);
        if(result == ParseResult.DONE) {
            if(this._cffiles.length < this._cfheader.cFiles) {
                this._cffiles.push(new CFFile());
                return Promise.resolve(ParseResult.RERUN);
            }
        }
        return result;
    }

    private async [METHOD_PARSE_DATAS](buffer: ReadBuffer): Promise<ParseResult> {
        if(this._totalReadBytes == this._cbCabinet) {
            return Promise.resolve(ParseResult.DONE);
        }
        if(!this._curFolder) {
            const index = ++this._readFolderIndex;
            const folder = this._cffolders[index];
            if(this._totalReadBytes != folder.coffCabStart) {
                if(this._totalReadBytes < folder.coffCabStart) {
                    const diff = folder.coffCabStart - this._totalReadBytes;
                    const avail = diff > buffer.remaining ? buffer.remaining : diff;
                    buffer.readBuffer(avail);
                    this._totalReadBytes += avail;
                }else{
                    throw Error('File error');
                }
            }
            this._curFolder = folder;
            this._curExtractContext = new ExtractContextImpl(this, folder, this._cffiles.filter(v => v.iFolder == index));
            this._curCfData = new CFData(this._cfheader, this._curExtractContext, this._curExtractContext.dataCount);
            return Promise.resolve(ParseResult.RERUN);
        }else{
            const res = await this._curCfData.parse(buffer);
            if(res == ParseResult.DONE) {
                this._curExtractContext.dataCount++;
                if(this._curExtractContext.dataCount == this._curExtractContext.folder.cCFData) {
                    this._curCfData = undefined as any;
                    return Promise.resolve(ParseResult.DONE);
                }

                this._curCfData = new CFData(this._cfheader, this._curExtractContext as ExtractContext, this._curExtractContext.dataCount);
                return Promise.resolve(ParseResult.RERUN);
            }
            return res;
        }
    }

    // 36
    _write(chunk: any, encoding: string, callback: (error?: (Error | null)) => void): void {
        if (this._destroyed) return;
        (async () => {
            try {
                const dataBuf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string, encoding as BufferEncoding);
                let footerBuffer: Buffer | null = null;
                if (this._parsers.length) {
                    const remainingCabinet = (this._cbCabinet < 0) ? (-1) : (this._cbCabinet - this._totalReadBytes);
                    let remainingBuf = this._buffer ? Buffer.concat([this._buffer, dataBuf]) : dataBuf;
                    let data;
                    if((remainingCabinet >= 0) && (remainingBuf.length > remainingCabinet)) {
                        data = new ReadBuffer({
                            buffer: remainingBuf,
                            offset: 0,
                            limit: remainingCabinet,
                            afterReadHandler: (v) => {
                                this._totalReadBytes += v;
                            }
                        });
                    }else{
                        data = new ReadBuffer({
                            buffer: remainingBuf,
                            afterReadHandler: (v) => {
                                this._totalReadBytes += v;
                            }
                        });
                    }

                    this._buffer = null;

                    while (this._parsers.length && data.remaining) {
                        let parser = this._parsers[0];
                        const res = await parser(data);

                        if (res == ParseResult.NEED_MORE) {
                            this._buffer = data.readRemainingBuffer();
                            break;
                        } else if (res == ParseResult.DONE) {
                            // NEXT
                            this._parsers.shift();
                        }
                    }
                    if (this._parsers.length == 0) {
                        this._partial = false;
                    }

                    if(data.footerSize > 0)
                        footerBuffer = data.getFooterBuffer();
                } else {
                    footerBuffer = dataBuf;
                }
                callback();
            } catch(err) {
                this.emit('error', err);
            }
        })();
    }

    _final(callback: (error?: (Error | null)) => void): void {
        if (this._partial)
            return this.destroy(new Error('Unexpected end of data'));
        callback();
        this.destroy();
    }

    destroy(err?: Error): void {
        if (this._destroyed) return ;
        this._destroyed = true;

        if (err) this.emit('error', err);
        this.emit('close');
    }
}
