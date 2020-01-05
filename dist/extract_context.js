"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ExtractContext {
    constructor(folder) {
        this.dataCount = 0;
        this.mszip_ = null;
        this.folder_ = folder;
    }
    get folder() {
        return this.folder_;
    }
    getMszip() {
        if (!this.mszip_) {
            this.mszip_ = {
                dictionary: null
            };
        }
        return this.mszip_;
    }
}
exports.ExtractContext = ExtractContext;
//# sourceMappingURL=extract_context.js.map