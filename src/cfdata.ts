import * as streams from 'stream';
import ReadBuffer from './read-buffer';
import {ParseResult} from './internals';
import {CFHeader, Flags} from './cfheader';
import {CompressType} from './cffolder';

import * as zlib from 'zlib';

import * as LzxModule from './lzx_decoder';
import * as LzxDecoderNative from './lzx_decoder_native';

import {ExtractContext} from './extract_context';

enum ParseStep {
    HEADER = 0,
    abReserve = 1,
    compData = 2,
    COMPLETE
}

const MSZIP_SIGNATURE = 0x4B43;

function computeCsum(buffer: Buffer, seed: number) {
    let i: number = Math.floor(buffer.length / 4);
    let csum: number = seed;
    const reader = new ReadBuffer(buffer);

    while(i-- > 0) {
        csum ^= reader.readUInt32LE();
    }

    let temp = 0;
    switch(reader.remaining) {
        case 3:
            temp |= reader.readUInt8() << 16;
        case 2:
            temp |= reader.readUInt8() << 8;
        case 1:
            temp |= reader.readUInt8();
        default:
    }
    csum ^= temp;

    return csum;
}

function BufferToBuffer(sb: Buffer, offset: number, size: number): Buffer {
    const genbuf = Buffer.alloc(size);
    const sized4 = Math.floor(size / 4);
    let srcpos = offset;
    let destpos = 0;
    for(let i=0; i < sized4; i++) {
        genbuf.writeUInt32LE(sb.readUInt32LE(srcpos), destpos);
        srcpos += 4;
        destpos += 4;
    }
    switch(size % 4) {
        case 3:
            genbuf.writeUInt8(sb.readUInt8(srcpos++), destpos++);
        case 2:
            genbuf.writeUInt8(sb.readUInt8(srcpos++), destpos++);
        case 1:
            genbuf.writeUInt8(sb.readUInt8(srcpos++), destpos++);
        default:
    }
    return genbuf;
}

export class CFData {
    private _cfHeader: CFHeader;
    private _extractContext: ExtractContext;
    private _index: number;

    private _csum: number = 0; // UInt32LE
    private _cbData: number = 0; // UInt16LE
    private _cbUncomp: number = 0; // UInt16LE
    private _abReserve: Buffer | null = null;
    private _compData: Buffer | null = null;

    private _checkBuffer!: Buffer;
    private _checkBufferOffset = 0;

    private _computedCsum: number = 0;

    private _uncompData: Buffer | null = null;

    private _parseStep: ParseStep = ParseStep.HEADER;

    constructor(cfHeader: CFHeader, extractContext: ExtractContext, index: number) {
        this._cfHeader = cfHeader;
        this._extractContext = extractContext;
        this._index = index;
    }

    public async parse(buffer: ReadBuffer, outputSteram: streams.Writable): Promise<ParseResult> {
        switch (this._parseStep) {
            case ParseStep.HEADER:
                if (buffer.remaining < 8) {
                    return Promise.resolve(ParseResult.NEED_MORE);
                }

                this._csum = buffer.readInt32LE();
                this._cbData = buffer.readUInt16LE();
                this._cbUncomp = buffer.readUInt16LE();

                const totalBytes = 4 + ((this._cfHeader.flags & Flags.cfhdrRESERVE_PRESENT) ? this._cfHeader.cbCFData : 0) + this._cbData;
                this._checkBuffer = Buffer.alloc(totalBytes);
                this._checkBuffer.writeUInt16LE(this._cbData, 0);
                this._checkBuffer.writeUInt16LE(this._cbUncomp, 2);
                this._checkBufferOffset = 4;

                this._parseStep++;

            case ParseStep.abReserve:
                if(this._cfHeader.flags & Flags.cfhdrRESERVE_PRESENT) {
                    if(buffer.remaining < this._cfHeader.cbCFData) {
                        return Promise.resolve(ParseResult.NEED_MORE);
                    }
                    this._abReserve = buffer.readBuffer(this._cfHeader.cbCFData);
                    this._abReserve.copy(this._checkBuffer, this._checkBufferOffset);
                    this._checkBufferOffset += this._cfHeader.cbCFData;
                }

                this._parseStep++;

            case ParseStep.compData:
            {
                const currentSize = this._compData ? this._compData.length : 0;
                const remaining = this._cbData - currentSize;
                const avail = (buffer.remaining < remaining) ? buffer.remaining : remaining;
                const readBuf = buffer.readBuffer(avail);
                if(this._compData) {
                    this._compData = Buffer.concat([this._compData, readBuf]);
                }else{
                    this._compData = readBuf;
                }
                if(this._compData.length < this._cbData) {
                    return Promise.resolve(ParseResult.NEED_MORE);
                }
                this._parseStep++;
            }

            case ParseStep.COMPLETE:
                if(this._compData) {
                    this._compData.copy(this._checkBuffer, this._checkBufferOffset);
                    this._checkBufferOffset += this._compData.length;
                }
        }

        this._computedCsum = computeCsum(this._checkBuffer, 0) & 0xffffffff;
        if(this._csum && this._csum != this._computedCsum) {
            throw new Error('Checksum error');
        }
        if(!this._compData) {
            return Promise.resolve(ParseResult.DONE);
        }
        const compressType = (this._extractContext.folder.typeCompress & 0x00ff);

        if(compressType == CompressType.MSZIP) {
            await this.uncompressMszip(outputSteram);
        }
        else if(compressType == CompressType.LZX) {
            await this.uncompressLzx(outputSteram);
        }
        else{
            throw new Error('Not supported compression type = ' + this._extractContext.folder.typeCompress);
        }
        return Promise.resolve(ParseResult.DONE);
    }

    async uncompressMszip(outputSteram: streams.Writable) {
        const compData = this._compData as Buffer;
        const sig = compData.readUInt16LE(0);
        if(sig != MSZIP_SIGNATURE) {
            throw new Error('MSZIP Signature error: ' + sig);
        }
        let zlibOffset = 2;
        let zlibRemaining = compData.length - 2;
        while(zlibRemaining > 0) {
            const buf = BufferToBuffer(compData, zlibOffset, zlibRemaining);
            const processed = await new Promise<number>((resolve, reject) => {
                let written = 0;
                const dictionary = this._extractContext.getMszip().dictionary;
                const inflate = zlib.createInflateRaw({
                    dictionary: dictionary ? dictionary : undefined
                });
                inflate
                    .on('error', (err) => {
                        reject(err);
                    })
                    .on('finish', () => {
                        inflate.close();
                    })
                    .on('close', () => {
                        this._extractContext.getMszip().dictionary = this._uncompData;
                        resolve(inflate.bytesWritten);
                    })
                    .on('data', (data) => {
                        if(this._uncompData) {
                            this._uncompData = Buffer.concat([this._uncompData, data]);
                        }else{
                            this._uncompData = data;
                        }
                        written += data.length;
                        outputSteram.write(data);
                    });
                inflate.write(buf);
                inflate.end();
            });
            zlibOffset += processed;
            zlibRemaining -= processed;
        }
    }

    async uncompressLzx(outputStream: streams.Writable) {
        const lzxContext = await this._extractContext.getLzx();
        let cur_input: Buffer | undefined = this._compData as Buffer;
        let result: LzxDecoderNative.Module.ILzxDecoderDecodeOutput;

        do {
            lzxContext.decoder.cleanupBitstream();
            result = lzxContext.decoder.decode(cur_input, 1);
            if (result.result < 0) {
                throw new Error("LZX Decode failed: " + result.result);
            }
            if ((result.result == LzxModule.ARCHIVE_OK) && (result.out_bytes < this._cbUncomp)) {
                throw new Error("LZX Decode unexcepted decoded size");
            }
            lzxContext.decoder.outputBufferTranslation(result.out_bytes, (this._index) * 0x8000);
            const output = lzxContext.decoder.getOutputBuffer(result.out_bytes);
            outputStream.write(output);
        } while(cur_input && result.result == LzxModule.ARCHIVE_EOF);
    }
}

