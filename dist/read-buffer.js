"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ReadBuffer {
    constructor(buffer, offset, limit) {
        if (Buffer.isBuffer(buffer)) {
            this._buffer = buffer;
            this._offset = offset || 0;
            this._limit = limit || buffer.length;
            this._afterReadHandler = undefined;
        }
        else {
            this._buffer = buffer.buffer;
            this._offset = buffer.offset || 0;
            this._limit = buffer.limit || buffer.buffer.length;
            this._afterReadHandler = buffer.afterReadHandler;
        }
    }
    readUIntLE(byteLength) {
        const out = this._buffer.readUIntLE(this._offset, byteLength);
        this._offset += byteLength;
        if (this._afterReadHandler)
            this._afterReadHandler(byteLength);
        return out;
    }
    readUIntBE(byteLength) {
        const out = this._buffer.readUIntBE(this._offset, byteLength);
        this._offset += byteLength;
        if (this._afterReadHandler)
            this._afterReadHandler(byteLength);
        return out;
    }
    readIntLE(byteLength) {
        const out = this._buffer.readIntLE(this._offset, byteLength);
        this._offset += byteLength;
        return out;
    }
    readIntBE(byteLength) {
        const out = this._buffer.readIntBE(this._offset, byteLength);
        this._offset += byteLength;
        if (this._afterReadHandler)
            this._afterReadHandler(byteLength);
        return out;
    }
    readUInt8(noAssert) {
        return this.readUIntLE(1);
    }
    readUInt16LE(noAssert) {
        return this.readUIntLE(2);
    }
    readUInt16BE(noAssert) {
        return this.readUIntBE(2);
    }
    readUInt32LE(noAssert) {
        return this.readUIntLE(4);
    }
    readUInt32BE(noAssert) {
        return this.readUIntBE(4);
    }
    readInt8(noAssert) {
        return this.readIntLE(1);
    }
    readInt16LE(noAssert) {
        return this.readIntLE(2);
    }
    readInt16BE(noAssert) {
        return this.readIntBE(4);
    }
    readInt32LE(noAssert) {
        return this.readIntLE(4);
    }
    readInt32BE(noAssert) {
        return this.readIntBE(4);
    }
    readFloatLE(noAssert) {
        const out = this._buffer.readFloatLE(this._offset);
        this._offset += 4;
        if (this._afterReadHandler)
            this._afterReadHandler(4);
        return out;
    }
    readFloatBE(noAssert) {
        const out = this._buffer.readFloatBE(this._offset);
        this._offset += 4;
        if (this._afterReadHandler)
            this._afterReadHandler(4);
        return out;
    }
    readDoubleLE(noAssert) {
        const out = this._buffer.readDoubleLE(this._offset);
        this._offset += 8;
        if (this._afterReadHandler)
            this._afterReadHandler(8);
        return out;
    }
    readDoubleBE(noAssert) {
        const out = this._buffer.readDoubleBE(this._offset);
        this._offset += 8;
        if (this._afterReadHandler)
            this._afterReadHandler(8);
        return out;
    }
    readBuffer(byteLength) {
        const dest = Buffer.alloc(byteLength);
        this._buffer.copy(dest, 0, this.offset, this.offset + byteLength);
        this._offset += byteLength;
        if (this._afterReadHandler)
            this._afterReadHandler(byteLength);
        return dest;
    }
    readString() {
        let ch = 1;
        let out = '';
        let complete = false;
        let count = 0;
        while (this.remaining > 0) {
            ch = this._buffer.readUInt8(this._offset++);
            count++;
            if (ch) {
                out += String.fromCharCode(ch);
            }
            else {
                complete = true;
                break;
            }
        }
        if (this._afterReadHandler)
            this._afterReadHandler(count);
        return { out, complete };
    }
    get offset() {
        return this._offset;
    }
    get remaining() {
        return this._limit - this._offset;
    }
    readRemainingBuffer() {
        const dest = Buffer.alloc(this.remaining);
        this._buffer.copy(dest, 0, this.offset, dest.length);
        this._offset += dest.length;
        if (this._afterReadHandler)
            this._afterReadHandler(dest.length);
        return dest;
    }
    get footerSize() {
        return this._buffer.length - this._limit;
    }
    getFooterBuffer() {
        const dest = Buffer.alloc(this.footerSize);
        this._buffer.copy(dest, 0, this._limit, dest.length);
        return dest;
    }
}
exports.default = ReadBuffer;
//# sourceMappingURL=read-buffer.js.map