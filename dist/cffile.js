"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const internals_1 = require("./internals");
var ParseStep;
(function (ParseStep) {
    ParseStep[ParseStep["HEADER"] = 0] = "HEADER";
    ParseStep[ParseStep["szName"] = 1] = "szName";
    ParseStep[ParseStep["COMPLETE"] = 2] = "COMPLETE";
})(ParseStep || (ParseStep = {}));
class CFFile {
    constructor() {
        this._cbFile = 0; // UInt32LE
        this._uoffFolderStart = 0; // UInt32LE
        this._iFolder = 0; // UInt16LE
        this._date = 0; // UInt16LE
        this._time = 0; // UInt16LE
        this._attribs = 0; // UInt16LE
        this._szName = '';
        this._parseStep = ParseStep.HEADER;
    }
    parse(buffer) {
        switch (this._parseStep) {
            case ParseStep.HEADER:
                if (buffer.remaining < 16) {
                    return Promise.resolve(internals_1.ParseResult.NEED_MORE);
                }
                this._cbFile = buffer.readUInt32LE();
                this._uoffFolderStart = buffer.readUInt32LE();
                this._iFolder = buffer.readUInt16LE();
                this._date = buffer.readUInt16LE();
                this._time = buffer.readUInt16LE();
                this._attribs = buffer.readUInt16LE();
                this._parseStep++;
            case ParseStep.szName:
                {
                    const chunk = buffer.readString();
                    this._szName += chunk.out;
                    if (!chunk.complete) {
                        return Promise.resolve(internals_1.ParseResult.NEED_MORE);
                    }
                }
                this._parseStep++;
            case ParseStep.COMPLETE:
        }
        return Promise.resolve(internals_1.ParseResult.DONE);
    }
    get cbFile() {
        return this._cbFile;
    }
    get uoffFolderStart() {
        return this._uoffFolderStart;
    }
    get iFolder() {
        return this._iFolder;
    }
    get date() {
        return this._date;
    }
    get time() {
        return this._time;
    }
    get attribs() {
        return this._attribs;
    }
    get szName() {
        return this._szName;
    }
    get name() {
        return this._szName;
    }
}
exports.CFFile = CFFile;
//# sourceMappingURL=cffile.js.map