/// <reference types="node" />
import ReadBuffer from './read-buffer';
import { ParseResult } from './internals';
/**
 * Cabinet file signature
 * ('MSCF', 4D 53 43 46)
 */
export declare const SIGNATURE = 1178817357;
export declare enum Flags {
    cfhdrPREV_CABINET = 1,
    cfhdrNEXT_CABINET = 2,
    cfhdrRESERVE_PRESENT = 4
}
export declare class CFHeader {
    private _signature;
    private _reserved1;
    private _cbCabinet;
    private _reserved2;
    private _coffFiles;
    private _reserved3;
    private _versionMinor;
    private _versionMajor;
    private _cFolders;
    private _cFiles;
    private _flags;
    private _setID;
    private _iCabinet;
    private _cbCFHeader;
    private _cbCFFolder;
    private _cbCFData;
    private _abReserve;
    private _szCabinetPrev;
    private _szDiskPrev;
    private _szCabinetNext;
    private _szDiskNext;
    private _parseStep;
    parse(buffer: ReadBuffer): Promise<ParseResult>;
    readonly signature: number;
    readonly reserved1: number;
    readonly cbCabinet: number;
    readonly reserved2: number;
    readonly coffFiles: number;
    readonly reserved3: number;
    readonly versionMinor: number;
    readonly versionMajor: number;
    readonly cFolders: number;
    readonly cFiles: number;
    readonly flags: number;
    readonly setID: number;
    readonly iCabinet: number;
    readonly cbCFHeader: number;
    readonly cbCFFolder: number;
    readonly cbCFData: number;
    readonly abReserve: Buffer | null;
    readonly szCabinetPrev: string | null;
    readonly szDiskPrev: string | null;
    readonly szCabinetNext: string | null;
    readonly szDiskNext: string | null;
}
//# sourceMappingURL=cfheader.d.ts.map