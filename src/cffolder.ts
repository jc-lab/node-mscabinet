import ReadBuffer from './read-buffer';
import {ParseResult} from './internals';
import {CFHeader, Flags} from "./cfheader";

enum ParseStep {
    HEADER = 0,
    abReserve = 1,
    COMPLETE
}

export enum CompressType {
    NONE = 0x0000,
    MSZIP = 0x0001,
    QUANTUM = 0x0002,
    LZX = 0x0003,
    // NOTE: Low 8 bits store compression extra
    // (for LZX the value between 15-21 [0x0F-0x15])
    // LZX21: 0x1503,
    // LZX15: 0x0F03,
}

export class CFFolder {
    private _cfHeader: CFHeader;

    private _coffCabStart: number = 0; // Uint32LE
    private _cCFData: number = 0; // Uint16LE
    private _typeCompress: CompressType | number = 0; // Uint16LE

    private _abReserve: Buffer | null = null;

    private _parseStep: ParseStep = ParseStep.HEADER;

    constructor(cfHeader: CFHeader) {
        this._cfHeader = cfHeader;
    }

    public parse(buffer: ReadBuffer): Promise<ParseResult> {
        switch (this._parseStep) {
            case ParseStep.HEADER:
                // Common header
                if (buffer.remaining < 8) {
                    return Promise.resolve(ParseResult.NEED_MORE);
                }

                this._coffCabStart = buffer.readUInt32LE();
                this._cCFData = buffer.readUInt16LE();
                this._typeCompress = buffer.readUInt16LE();
                this._parseStep++;

            case ParseStep.abReserve:
                // abReserve
                if (this._cfHeader.flags & Flags.cfhdrRESERVE_PRESENT) {
                    if (buffer.remaining < this._cfHeader.cbCFFolder) {
                        return Promise.resolve(ParseResult.NEED_MORE);
                    }
                    this._abReserve = buffer.readBuffer(this._cfHeader.cbCFFolder);
                }
                this._parseStep++;

            case ParseStep.COMPLETE:
        }
        return Promise.resolve(ParseResult.DONE);
    }

    get cfHeader(): CFHeader {
        return this._cfHeader;
    }

    get coffCabStart(): number {
        return this._coffCabStart;
    }

    get cCFData(): number {
        return this._cCFData;
    }

    get typeCompress(): CompressType | number {
        return this._typeCompress;
    }

    get abReserve(): Buffer | null {
        return this._abReserve;
    }
}
