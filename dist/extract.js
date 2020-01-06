"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const streams = __importStar(require("stream"));
const read_buffer_1 = __importDefault(require("./read-buffer"));
const internals_1 = require("./internals");
const cfheader_1 = require("./cfheader");
const cffolder_1 = require("./cffolder");
const cffile_1 = require("./cffile");
const cfdata_1 = require("./cfdata");
const extract_context_1 = require("./extract_context");
const METHOD_PARSE_HEADER = Symbol('PARSE_HEADER');
const METHOD_PARSE_FOLDERS = Symbol('PARSE_FOLDERS');
const METHOD_PARSE_HEADER_PAD = Symbol('PARSE_HEADER_PAD');
const METHOD_PARSE_FILES = Symbol('PARSE_FILES');
const METHOD_PARSE_DATAS = Symbol('PARSE_DATAS');
class EntryStream extends streams.PassThrough {
    constructor() {
        super();
    }
    init(index, size) {
        return __awaiter(this, void 0, void 0, function* () {
            const meta = {
                index,
                size,
                offset: 0
            };
            this._meta = meta;
            return new Promise((resolve, reject) => {
                meta.nextPromise = new Promise((next_resolve, next_reject) => {
                    meta.next = {
                        resolve: next_resolve,
                        reject: next_reject
                    };
                    resolve();
                });
            });
        });
    }
    get remaining() {
        return this._meta.size - this._meta.offset;
    }
    get meta() {
        return this._meta;
    }
}
class ExtractContextImpl extends extract_context_1.ExtractContext {
    constructor(target, folder, cffiles) {
        super(folder);
        this.processing = null;
        this._target = target;
        this._cffiles = cffiles;
        this.offset = 0;
    }
    getNextFileIndex(prev) {
        let nextIndex = prev ? (prev.index + 1) : 0;
        if (nextIndex >= this._cffiles.length) {
            return -1;
        }
        return nextIndex;
    }
    consumeData(data) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                const reader = new read_buffer_1.default(data);
                do {
                    let prepareNext = false;
                    let currentMeta = null;
                    if (this.processing) {
                        const cur = this.processing;
                        const entryRemaining = cur.remaining;
                        const avail = reader.remaining < entryRemaining ? reader.remaining : entryRemaining;
                        const partial = reader.readBuffer(avail);
                        cur.write(partial);
                        cur.meta.offset += avail;
                        currentMeta = cur.meta;
                        if (cur.remaining == 0) {
                            cur.end();
                            yield cur.meta.nextPromise;
                            prepareNext = true;
                        }
                    }
                    else {
                        prepareNext = true;
                    }
                    if (prepareNext) {
                        const nextIndex = this.getNextFileIndex(currentMeta);
                        if (nextIndex < 0) {
                            break;
                        }
                        const file = this._cffiles[nextIndex];
                        const cur = this.processing = new EntryStream();
                        yield this.processing.init(nextIndex, file.cbFile);
                        this._target.emit('entry', file, this.processing, () => {
                            cur.meta.next.resolve();
                        });
                    }
                } while (this.processing && (reader.remaining > 0));
                resolve();
            }
            catch (e) {
                reject(e);
            }
        }));
    }
}
class Extract extends streams.Writable {
    constructor(opts) {
        super(opts);
        this._destroyed = false;
        this._partial = false;
        this._readFolderIndex = -1;
        this._curFolder = null;
        this._destroyed = false;
        this._partial = false;
        this._totalReadBytes = 0;
        this._cbCabinet = -1;
        this._cfheader = new cfheader_1.CFHeader();
        this._parsers = [
            this[METHOD_PARSE_HEADER].bind(this),
            this[METHOD_PARSE_FOLDERS].bind(this),
            this[METHOD_PARSE_HEADER_PAD].bind(this),
            this[METHOD_PARSE_FILES].bind(this),
            this[METHOD_PARSE_DATAS].bind(this)
        ];
        this._buffer = null;
    }
    [METHOD_PARSE_HEADER](buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this._cfheader.parse(buffer);
            if (result == internals_1.ParseResult.DONE) {
                this._cffolders = [];
                this._cbCabinet = this._cfheader.cbCabinet;
            }
            return result;
        });
    }
    [METHOD_PARSE_FOLDERS](buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            //TODO: Check folder's data end position (end = next_folder_header_begin)
            if (this._cfheader.cFolders == 0) {
                return Promise.resolve(internals_1.ParseResult.DONE);
            }
            if (this._cffolders.length == 0) {
                this._cffolders.push(new cffolder_1.CFFolder(this._cfheader));
            }
            const current = this._cffolders[this._cffolders.length - 1];
            const result = yield current.parse(buffer);
            if (result == internals_1.ParseResult.DONE) {
                if (this._cffolders.length < this._cfheader.cFolders) {
                    this._cffolders.push(new cffolder_1.CFFolder(this._cfheader));
                    return Promise.resolve(internals_1.ParseResult.RERUN);
                }
                else {
                    this._cffiles = [];
                }
            }
            return result;
        });
    }
    [METHOD_PARSE_HEADER_PAD](buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._cfheader.coffFiles != this._totalReadBytes) {
                if (this._cfheader.coffFiles > this._totalReadBytes) {
                    const pad = this._cfheader.coffFiles - this._totalReadBytes;
                    if (buffer.remaining < pad) {
                        return Promise.resolve(internals_1.ParseResult.NEED_MORE);
                    }
                    buffer.readBuffer(pad);
                    this._totalReadBytes += pad;
                }
                else {
                    throw new Error('File error');
                }
            }
            return Promise.resolve(internals_1.ParseResult.DONE);
        });
    }
    [METHOD_PARSE_FILES](buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._cfheader.cFiles == 0) {
                return Promise.resolve(internals_1.ParseResult.DONE);
            }
            if (this._cffiles.length == 0) {
                this._cffiles.push(new cffile_1.CFFile());
            }
            const current = this._cffiles[this._cffiles.length - 1];
            const result = yield current.parse(buffer);
            if (result == internals_1.ParseResult.DONE) {
                if (this._cffiles.length < this._cfheader.cFiles) {
                    this._cffiles.push(new cffile_1.CFFile());
                    return Promise.resolve(internals_1.ParseResult.RERUN);
                }
            }
            return result;
        });
    }
    [METHOD_PARSE_DATAS](buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._totalReadBytes == this._cbCabinet) {
                return Promise.resolve(internals_1.ParseResult.DONE);
            }
            if (!this._curFolder) {
                const index = ++this._readFolderIndex;
                const folder = this._cffolders[index];
                if (this._totalReadBytes != folder.coffCabStart) {
                    if (this._totalReadBytes < folder.coffCabStart) {
                        const diff = folder.coffCabStart - this._totalReadBytes;
                        const avail = diff > buffer.remaining ? buffer.remaining : diff;
                        buffer.readBuffer(avail);
                        this._totalReadBytes += avail;
                    }
                    else {
                        throw Error('File error');
                    }
                }
                this._curFolder = folder;
                this._curExtractContext = new ExtractContextImpl(this, folder, this._cffiles.filter(v => v.iFolder == index));
                this._curCfData = new cfdata_1.CFData(this._cfheader, this._curExtractContext, this._curExtractContext.dataCount);
                return Promise.resolve(internals_1.ParseResult.RERUN);
            }
            else {
                const res = yield this._curCfData.parse(buffer);
                if (res == internals_1.ParseResult.DONE) {
                    this._curExtractContext.dataCount++;
                    if (this._curExtractContext.dataCount == this._curExtractContext.folder.cCFData) {
                        this._curCfData = undefined;
                        return Promise.resolve(internals_1.ParseResult.DONE);
                    }
                    this._curCfData = new cfdata_1.CFData(this._cfheader, this._curExtractContext, this._curExtractContext.dataCount);
                    return Promise.resolve(internals_1.ParseResult.RERUN);
                }
                return res;
            }
        });
    }
    // 36
    _write(chunk, encoding, callback) {
        if (this._destroyed)
            return;
        (() => __awaiter(this, void 0, void 0, function* () {
            try {
                const dataBuf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
                let footerBuffer = null;
                if (this._parsers.length) {
                    const remainingCabinet = (this._cbCabinet < 0) ? (-1) : (this._cbCabinet - this._totalReadBytes);
                    let remainingBuf = this._buffer ? Buffer.concat([this._buffer, dataBuf]) : dataBuf;
                    let data;
                    if ((remainingCabinet >= 0) && (remainingBuf.length > remainingCabinet)) {
                        data = new read_buffer_1.default({
                            buffer: remainingBuf,
                            offset: 0,
                            limit: remainingCabinet,
                            afterReadHandler: (v) => {
                                this._totalReadBytes += v;
                            }
                        });
                    }
                    else {
                        data = new read_buffer_1.default({
                            buffer: remainingBuf,
                            afterReadHandler: (v) => {
                                this._totalReadBytes += v;
                            }
                        });
                    }
                    this._buffer = null;
                    while (this._parsers.length && data.remaining) {
                        let parser = this._parsers[0];
                        const res = yield parser(data);
                        if (res == internals_1.ParseResult.NEED_MORE) {
                            this._buffer = data.readRemainingBuffer();
                            break;
                        }
                        else if (res == internals_1.ParseResult.DONE) {
                            // NEXT
                            this._parsers.shift();
                        }
                    }
                    if (this._parsers.length == 0) {
                        this._partial = false;
                    }
                    if (data.footerSize > 0)
                        footerBuffer = data.getFooterBuffer();
                }
                else {
                    footerBuffer = dataBuf;
                }
                callback();
            }
            catch (err) {
                this.emit('error', err);
            }
        }))();
    }
    _final(callback) {
        if (this._partial)
            return this.destroy(new Error('Unexpected end of data'));
        callback();
        this.destroy();
    }
    destroy(err) {
        if (this._destroyed)
            return;
        this._destroyed = true;
        if (err)
            this.emit('error', err);
        this.emit('close');
    }
}
exports.Extract = Extract;
//# sourceMappingURL=extract.js.map