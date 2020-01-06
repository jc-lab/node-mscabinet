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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const read_buffer_1 = __importDefault(require("./read-buffer"));
const internals_1 = require("./internals");
const cfheader_1 = require("./cfheader");
const cffolder_1 = require("./cffolder");
const zlib = __importStar(require("zlib"));
var ParseStep;
(function (ParseStep) {
    ParseStep[ParseStep["HEADER"] = 0] = "HEADER";
    ParseStep[ParseStep["abReserve"] = 1] = "abReserve";
    ParseStep[ParseStep["compData"] = 2] = "compData";
    ParseStep[ParseStep["COMPLETE"] = 3] = "COMPLETE";
})(ParseStep || (ParseStep = {}));
const MSZIP_SIGNATURE = 0x4B43;
function computeCsum(buffer, seed) {
    let i = Math.floor(buffer.length / 4);
    let csum = seed;
    const reader = new read_buffer_1.default(buffer);
    while (i-- > 0) {
        csum ^= reader.readUInt32LE();
    }
    let temp = 0;
    switch (reader.remaining) {
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
function BufferToBuffer(sb, offset, size) {
    const genbuf = Buffer.alloc(size);
    const sized4 = Math.floor(size / 4);
    let srcpos = offset;
    let destpos = 0;
    for (let i = 0; i < sized4; i++) {
        genbuf.writeUInt32LE(sb.readUInt32LE(srcpos), destpos);
        srcpos += 4;
        destpos += 4;
    }
    switch (size % 4) {
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
class CFData {
    constructor(cfHeader, extractContext, index) {
        this._csum = 0; // UInt32LE
        this._cbData = 0; // UInt16LE
        this._cbUncomp = 0; // UInt16LE
        this._abReserve = null;
        this._compData = null;
        this._checkBufferOffset = 0;
        this._computedCsum = 0;
        this._uncompData = null;
        this._parseStep = ParseStep.HEADER;
        this._cfHeader = cfHeader;
        this._extractContext = extractContext;
        this._index = index;
    }
    parse(buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (this._parseStep) {
                case ParseStep.HEADER:
                    if (buffer.remaining < 8) {
                        return Promise.resolve(internals_1.ParseResult.NEED_MORE);
                    }
                    this._csum = buffer.readInt32LE();
                    this._cbData = buffer.readUInt16LE();
                    this._cbUncomp = buffer.readUInt16LE();
                    const totalBytes = 4 + ((this._cfHeader.flags & cfheader_1.Flags.cfhdrRESERVE_PRESENT) ? this._cfHeader.cbCFData : 0) + this._cbData;
                    this._checkBuffer = Buffer.alloc(totalBytes);
                    this._checkBuffer.writeUInt16LE(this._cbData, 0);
                    this._checkBuffer.writeUInt16LE(this._cbUncomp, 2);
                    this._checkBufferOffset = 4;
                    this._parseStep++;
                case ParseStep.abReserve:
                    if (this._cfHeader.flags & cfheader_1.Flags.cfhdrRESERVE_PRESENT) {
                        if (buffer.remaining < this._cfHeader.cbCFData) {
                            return Promise.resolve(internals_1.ParseResult.NEED_MORE);
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
                        if (this._compData) {
                            this._compData = Buffer.concat([this._compData, readBuf]);
                        }
                        else {
                            this._compData = readBuf;
                        }
                        if (this._compData.length < this._cbData) {
                            return Promise.resolve(internals_1.ParseResult.NEED_MORE);
                        }
                        this._parseStep++;
                    }
                case ParseStep.COMPLETE:
                    if (this._compData) {
                        this._compData.copy(this._checkBuffer, this._checkBufferOffset);
                        this._checkBufferOffset += this._compData.length;
                    }
            }
            this._computedCsum = computeCsum(this._checkBuffer, 0) & 0xffffffff;
            if (this._csum && this._csum != this._computedCsum) {
                throw new Error('Checksum error');
            }
            if (!this._compData) {
                return Promise.resolve(internals_1.ParseResult.DONE);
            }
            const compressType = (this._extractContext.folder.typeCompress & 0x00ff);
            if (compressType == cffolder_1.CompressType.MSZIP) {
                yield this.uncompressMszip();
            }
            // else if(compressType == CompressType.LZX) {
            //
            // }
            else {
                throw new Error('Not supported compression type = ' + this._extractContext.folder.typeCompress);
            }
            return Promise.resolve(internals_1.ParseResult.DONE);
        });
    }
    uncompressMszip() {
        return __awaiter(this, void 0, void 0, function* () {
            const compData = this._compData;
            const sig = compData.readUInt16LE(0);
            if (sig != MSZIP_SIGNATURE) {
                throw new Error('MSZIP Signature error: ' + sig);
            }
            let zlibOffset = 2;
            let zlibRemaining = compData.length - 2;
            while (zlibRemaining > 0) {
                const buf = BufferToBuffer(compData, zlibOffset, zlibRemaining);
                let totalBuffer = null;
                const processed = yield new Promise((resolve, reject) => {
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
                        if (this._uncompData) {
                            this._uncompData = Buffer.concat([this._uncompData, data]);
                        }
                        else {
                            this._uncompData = data;
                        }
                        written += data.length;
                        if (totalBuffer) {
                            totalBuffer = Buffer.concat([totalBuffer, data]);
                        }
                        else {
                            totalBuffer = data;
                        }
                    });
                    inflate.write(buf);
                    inflate.end();
                });
                if (totalBuffer) {
                    yield this._extractContext.consumeData(totalBuffer);
                }
                zlibOffset += processed;
                zlibRemaining -= processed;
            }
        });
    }
}
exports.CFData = CFData;
//# sourceMappingURL=cfdata.js.map