/// <reference types="node" />
export interface IOptions {
    buffer: Buffer;
    offset?: number;
    limit?: number;
    afterReadHandler?: (bytes: number) => void;
}
export default class ReadBuffer {
    private _buffer;
    private _offset;
    private _limit;
    private _afterReadHandler?;
    constructor(buffer: Buffer | IOptions, offset?: number, limit?: number);
    readUIntLE(byteLength: number): number;
    readUIntBE(byteLength: number): number;
    readIntLE(byteLength: number): number;
    readIntBE(byteLength: number): number;
    readUInt8(noAssert?: boolean): number;
    readUInt16LE(noAssert?: boolean): number;
    readUInt16BE(noAssert?: boolean): number;
    readUInt32LE(noAssert?: boolean): number;
    readUInt32BE(noAssert?: boolean): number;
    readInt8(noAssert?: boolean): number;
    readInt16LE(noAssert?: boolean): number;
    readInt16BE(noAssert?: boolean): number;
    readInt32LE(noAssert?: boolean): number;
    readInt32BE(noAssert?: boolean): number;
    readFloatLE(noAssert?: boolean): number;
    readFloatBE(noAssert?: boolean): number;
    readDoubleLE(noAssert?: boolean): number;
    readDoubleBE(noAssert?: boolean): number;
    readBuffer(byteLength: number): Buffer;
    readString(): {
        out: string;
        complete: boolean;
    };
    readonly offset: number;
    readonly remaining: number;
    readRemainingBuffer(): Buffer;
    readonly footerSize: number;
    getFooterBuffer(): Buffer;
}
//# sourceMappingURL=read-buffer.d.ts.map