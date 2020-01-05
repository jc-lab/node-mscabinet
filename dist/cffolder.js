"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const internals_1 = require("./internals");
const cfheader_1 = require("./cfheader");
var ParseStep;
(function (ParseStep) {
    ParseStep[ParseStep["HEADER"] = 0] = "HEADER";
    ParseStep[ParseStep["abReserve"] = 1] = "abReserve";
    ParseStep[ParseStep["COMPLETE"] = 2] = "COMPLETE";
})(ParseStep || (ParseStep = {}));
var CompressType;
(function (CompressType) {
    CompressType[CompressType["NONE"] = 0] = "NONE";
    CompressType[CompressType["MSZIP"] = 1] = "MSZIP";
    CompressType[CompressType["QUANTUM"] = 2] = "QUANTUM";
    CompressType[CompressType["LZX"] = 3] = "LZX";
    // NOTE: Low 8 bits store compression extra
    // (for LZX the value between 15-21 [0x0F-0x15])
    // LZX21: 0x1503,
    // LZX15: 0x0F03,
})(CompressType = exports.CompressType || (exports.CompressType = {}));
class CFFolder {
    constructor(cfHeader) {
        this._coffCabStart = 0; // Uint32LE
        this._cCFData = 0; // Uint16LE
        this._typeCompress = 0; // Uint16LE
        this._abReserve = null;
        this._parseStep = ParseStep.HEADER;
        this._cfHeader = cfHeader;
    }
    parse(buffer) {
        switch (this._parseStep) {
            case ParseStep.HEADER:
                // Common header
                if (buffer.remaining < 8) {
                    return Promise.resolve(internals_1.ParseResult.NEED_MORE);
                }
                this._coffCabStart = buffer.readUInt32LE();
                this._cCFData = buffer.readUInt16LE();
                this._typeCompress = buffer.readUInt16LE();
                this._parseStep++;
            case ParseStep.abReserve:
                // abReserve
                if (this._cfHeader.flags & cfheader_1.Flags.cfhdrRESERVE_PRESENT) {
                    if (buffer.remaining < this._cfHeader.cbCFFolder) {
                        return Promise.resolve(internals_1.ParseResult.NEED_MORE);
                    }
                    this._abReserve = buffer.readBuffer(this._cfHeader.cbCFFolder);
                }
                this._parseStep++;
            case ParseStep.COMPLETE:
        }
        return Promise.resolve(internals_1.ParseResult.DONE);
    }
    get cfHeader() {
        return this._cfHeader;
    }
    get coffCabStart() {
        return this._coffCabStart;
    }
    get cCFData() {
        return this._cCFData;
    }
    get typeCompress() {
        return this._typeCompress;
    }
    get abReserve() {
        return this._abReserve;
    }
}
exports.CFFolder = CFFolder;
//# sourceMappingURL=cffolder.js.map