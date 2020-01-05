"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const internals_1 = require("./internals");
/**
 * Cabinet file signature
 * ('MSCF', 4D 53 43 46)
 */
exports.SIGNATURE = 0x4643534D;
var Flags;
(function (Flags) {
    Flags[Flags["cfhdrPREV_CABINET"] = 1] = "cfhdrPREV_CABINET";
    Flags[Flags["cfhdrNEXT_CABINET"] = 2] = "cfhdrNEXT_CABINET";
    Flags[Flags["cfhdrRESERVE_PRESENT"] = 4] = "cfhdrRESERVE_PRESENT";
})(Flags = exports.Flags || (exports.Flags = {}));
var ParseStep;
(function (ParseStep) {
    ParseStep[ParseStep["HEADER"] = 0] = "HEADER";
    ParseStep[ParseStep["cbCFHeader"] = 1] = "cbCFHeader";
    ParseStep[ParseStep["cbCFFolder"] = 2] = "cbCFFolder";
    ParseStep[ParseStep["cbCFData"] = 3] = "cbCFData";
    ParseStep[ParseStep["abReserve"] = 4] = "abReserve";
    ParseStep[ParseStep["szCabinetPrev"] = 5] = "szCabinetPrev";
    ParseStep[ParseStep["szDiskPrev"] = 6] = "szDiskPrev";
    ParseStep[ParseStep["szCabinetNext"] = 7] = "szCabinetNext";
    ParseStep[ParseStep["szDiskNext"] = 8] = "szDiskNext";
    ParseStep[ParseStep["COMPLETE"] = 9] = "COMPLETE";
})(ParseStep || (ParseStep = {}));
class CFHeader {
    constructor() {
        this._signature = 0; // Uint32LE
        this._reserved1 = 0; // Uint32LE
        this._cbCabinet = 0; // Uint32LE
        this._reserved2 = 0; // Uint32LE
        this._coffFiles = 0; // Uint32LE
        this._reserved3 = 0; // Uint32LE
        this._versionMinor = 0; // Uint8
        this._versionMajor = 0; // Uint8
        this._cFolders = 0; // Uint16LE
        this._cFiles = 0; // Uint16LE
        this._flags = 0; // Uint16LE
        this._setID = 0; // Uint16LE
        this._iCabinet = 0; // Uint16LE
        this._cbCFHeader = 0; // Uint16LE (optional)
        this._cbCFFolder = 0; // Uint8 (optional)
        this._cbCFData = 0; // Uint8 (optional)
        this._abReserve = null;
        this._szCabinetPrev = null;
        this._szDiskPrev = null;
        this._szCabinetNext = null;
        this._szDiskNext = null;
        this._parseStep = ParseStep.HEADER;
    }
    parse(buffer) {
        switch (this._parseStep) {
            case ParseStep.HEADER:
                // Common header
                if (buffer.remaining < 36) {
                    return Promise.resolve(internals_1.ParseResult.NEED_MORE);
                }
                this._signature = buffer.readUInt32LE();
                if (this._signature != exports.SIGNATURE) {
                    throw new Error('Invalid signature = ' + this._signature);
                }
                this._reserved1 = buffer.readUInt32LE();
                this._cbCabinet = buffer.readUInt32LE();
                this._reserved2 = buffer.readUInt32LE();
                this._coffFiles = buffer.readUInt32LE();
                this._reserved3 = buffer.readUInt32LE();
                this._versionMinor = buffer.readUInt8();
                this._versionMajor = buffer.readUInt8();
                this._cFolders = buffer.readUInt16LE();
                this._cFiles = buffer.readUInt16LE();
                this._flags = buffer.readUInt16LE();
                this._setID = buffer.readUInt16LE();
                this._iCabinet = buffer.readUInt16LE();
                this._parseStep++;
            case ParseStep.cbCFHeader:
                // cbCFHeader
                if (this._flags & Flags.cfhdrRESERVE_PRESENT) {
                    if (buffer.remaining < 4) {
                        return Promise.resolve(internals_1.ParseResult.NEED_MORE);
                    }
                    this._cbCFHeader = buffer.readUInt16LE();
                }
                this._parseStep++;
            case ParseStep.cbCFFolder:
                // cbCFFolder
                if (this._flags & Flags.cfhdrRESERVE_PRESENT) {
                    if (buffer.remaining < 4) {
                        return Promise.resolve(internals_1.ParseResult.NEED_MORE);
                    }
                    this._cbCFFolder = buffer.readUInt16LE();
                }
                this._parseStep++;
            case ParseStep.cbCFData:
                // cbCFData
                if (this._flags & Flags.cfhdrRESERVE_PRESENT) {
                    if (buffer.remaining < 4) {
                        return Promise.resolve(internals_1.ParseResult.NEED_MORE);
                    }
                    this._cbCFData = buffer.readUInt16LE();
                }
                this._parseStep++;
            case ParseStep.abReserve:
                // abReserve
                if (this._flags & Flags.cfhdrRESERVE_PRESENT) {
                    if (buffer.remaining < this._cbCFHeader) {
                        return Promise.resolve(internals_1.ParseResult.NEED_MORE);
                    }
                    this._abReserve = buffer.readBuffer(this._cbCFHeader);
                }
                this._parseStep++;
            case ParseStep.szCabinetPrev:
                // szCabinetPrev
                if (this._flags & Flags.cfhdrPREV_CABINET) {
                    if (!this._szCabinetPrev) {
                        this._szCabinetPrev = '';
                    }
                    const chunk = buffer.readString();
                    this._szCabinetPrev += chunk.out;
                    if (!chunk.complete) {
                        return Promise.resolve(internals_1.ParseResult.NEED_MORE);
                    }
                }
                this._parseStep++;
            case ParseStep.szDiskPrev:
                // szDiskPrev
                if (this._flags & Flags.cfhdrPREV_CABINET) {
                    if (!this._szDiskPrev) {
                        this._szDiskPrev = '';
                    }
                    const chunk = buffer.readString();
                    this._szDiskPrev += chunk.out;
                    if (!chunk.complete) {
                        return Promise.resolve(internals_1.ParseResult.NEED_MORE);
                    }
                }
                this._parseStep++;
            case ParseStep.szCabinetNext:
                // szCabinetNext
                if (this._flags & Flags.cfhdrPREV_CABINET) {
                    if (!this._szCabinetNext) {
                        this._szCabinetNext = '';
                    }
                    const chunk = buffer.readString();
                    this._szCabinetNext += chunk.out;
                    if (!chunk.complete) {
                        return Promise.resolve(internals_1.ParseResult.NEED_MORE);
                    }
                }
                this._parseStep++;
            case ParseStep.szDiskNext:
                // szDiskNext
                if (this._flags & Flags.cfhdrPREV_CABINET) {
                    if (!this._szDiskNext) {
                        this._szDiskNext = '';
                    }
                    const chunk = buffer.readString();
                    this._szDiskNext += chunk.out;
                    if (!chunk.complete) {
                        return Promise.resolve(internals_1.ParseResult.NEED_MORE);
                    }
                }
                this._parseStep++;
            case ParseStep.COMPLETE:
        }
        return Promise.resolve(internals_1.ParseResult.DONE);
    }
    get signature() {
        return this._signature;
    }
    get reserved1() {
        return this._reserved1;
    }
    get cbCabinet() {
        return this._cbCabinet;
    }
    get reserved2() {
        return this._reserved2;
    }
    get coffFiles() {
        return this._coffFiles;
    }
    get reserved3() {
        return this._reserved3;
    }
    get versionMinor() {
        return this._versionMinor;
    }
    get versionMajor() {
        return this._versionMajor;
    }
    get cFolders() {
        return this._cFolders;
    }
    get cFiles() {
        return this._cFiles;
    }
    get flags() {
        return this._flags;
    }
    get setID() {
        return this._setID;
    }
    get iCabinet() {
        return this._iCabinet;
    }
    get cbCFHeader() {
        return this._cbCFHeader;
    }
    get cbCFFolder() {
        return this._cbCFFolder;
    }
    get cbCFData() {
        return this._cbCFData;
    }
    get abReserve() {
        return this._abReserve;
    }
    get szCabinetPrev() {
        return this._szCabinetPrev;
    }
    get szDiskPrev() {
        return this._szDiskPrev;
    }
    get szCabinetNext() {
        return this._szCabinetNext;
    }
    get szDiskNext() {
        return this._szDiskNext;
    }
}
exports.CFHeader = CFHeader;
//# sourceMappingURL=cfheader.js.map