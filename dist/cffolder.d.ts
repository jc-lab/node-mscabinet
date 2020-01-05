/// <reference types="node" />
import ReadBuffer from './read-buffer';
import { ParseResult } from './internals';
import { CFHeader } from "./cfheader";
export declare enum CompressType {
    NONE = 0,
    MSZIP = 1,
    QUANTUM = 2,
    LZX = 3
}
export declare class CFFolder {
    private _cfHeader;
    private _coffCabStart;
    private _cCFData;
    private _typeCompress;
    private _abReserve;
    private _parseStep;
    constructor(cfHeader: CFHeader);
    parse(buffer: ReadBuffer): Promise<ParseResult>;
    readonly cfHeader: CFHeader;
    readonly coffCabStart: number;
    readonly cCFData: number;
    readonly typeCompress: CompressType | number;
    readonly abReserve: Buffer | null;
}
//# sourceMappingURL=cffolder.d.ts.map