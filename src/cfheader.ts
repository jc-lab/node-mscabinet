import ReadBuffer from './read-buffer';
import {ParseResult} from './internals';

/**
 * Cabinet file signature
 * ('MSCF', 4D 53 43 46)
 */
export const SIGNATURE = 0x4643534D;

export enum Flags {
    cfhdrPREV_CABINET = 0x0001,
    cfhdrNEXT_CABINET = 0x0002,
    cfhdrRESERVE_PRESENT = 0x0004
}

enum ParseStep {
    HEADER = 0,
    cbCFHeader = 1,
    cbCFFolder = 2,
    cbCFData = 3,
    abReserve = 4,
    szCabinetPrev = 5,
    szDiskPrev = 6,
    szCabinetNext = 7,
    szDiskNext = 8,
    COMPLETE
}

export class CFHeader {
    private _signature: number = 0; // Uint32LE
    private _reserved1: number = 0; // Uint32LE
    private _cbCabinet: number = 0; // Uint32LE
    private _reserved2: number = 0; // Uint32LE
    private _coffFiles: number = 0; // Uint32LE
    private _reserved3: number = 0; // Uint32LE
    private _versionMinor: number = 0; // Uint8
    private _versionMajor: number = 0; // Uint8
    private _cFolders: number = 0; // Uint16LE
    private _cFiles: number = 0; // Uint16LE
    private _flags: number = 0; // Uint16LE
    private _setID: number = 0; // Uint16LE
    private _iCabinet: number = 0; // Uint16LE
    private _cbCFHeader: number = 0; // Uint16LE (optional)
    private _cbCFFolder: number = 0; // Uint8 (optional)
    private _cbCFData: number = 0; // Uint8 (optional)

    private _abReserve: Buffer | null = null;
    private _szCabinetPrev: string | null = null;
    private _szDiskPrev: string | null = null;
    private _szCabinetNext: string | null = null;
    private _szDiskNext: string | null = null;

    private _parseStep: ParseStep = ParseStep.HEADER;

    public parse(buffer: ReadBuffer): Promise<ParseResult> {
        switch (this._parseStep) {
            case ParseStep.HEADER:
                // Common header
                if (buffer.remaining < 36) {
                    return Promise.resolve(ParseResult.NEED_MORE);
                }

                this._signature = buffer.readUInt32LE();
                if(this._signature != SIGNATURE) {
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
                        return Promise.resolve(ParseResult.NEED_MORE);
                    }
                    this._cbCFHeader = buffer.readUInt16LE();
                }
                this._parseStep++;

            case ParseStep.cbCFFolder:
                // cbCFFolder
                if (this._flags & Flags.cfhdrRESERVE_PRESENT) {
                    if (buffer.remaining < 4) {
                        return Promise.resolve(ParseResult.NEED_MORE);
                    }
                    this._cbCFFolder = buffer.readUInt16LE();
                }
                this._parseStep++;

            case ParseStep.cbCFData:
                // cbCFData
                if (this._flags & Flags.cfhdrRESERVE_PRESENT) {
                    if (buffer.remaining < 4) {
                        return Promise.resolve(ParseResult.NEED_MORE);
                    }
                    this._cbCFData = buffer.readUInt16LE();
                }
                this._parseStep++;

            case ParseStep.abReserve:
                // abReserve
                if (this._flags & Flags.cfhdrRESERVE_PRESENT) {
                    if (buffer.remaining < this._cbCFHeader) {
                        return Promise.resolve(ParseResult.NEED_MORE);
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
                    if(!chunk.complete) {
                        return Promise.resolve(ParseResult.NEED_MORE);
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
                    if(!chunk.complete) {
                        return Promise.resolve(ParseResult.NEED_MORE);
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
                    if(!chunk.complete) {
                        return Promise.resolve(ParseResult.NEED_MORE);
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
                    if(!chunk.complete) {
                        return Promise.resolve(ParseResult.NEED_MORE);
                    }
                }
                this._parseStep++;

            case ParseStep.COMPLETE:
        }
        return Promise.resolve(ParseResult.DONE);
    }

    get signature(): number {
        return this._signature;
    }

    get reserved1(): number {
        return this._reserved1;
    }

    get cbCabinet(): number {
        return this._cbCabinet;
    }

    get reserved2(): number {
        return this._reserved2;
    }

    get coffFiles(): number {
        return this._coffFiles;
    }

    get reserved3(): number {
        return this._reserved3;
    }

    get versionMinor(): number {
        return this._versionMinor;
    }

    get versionMajor(): number {
        return this._versionMajor;
    }

    get cFolders(): number {
        return this._cFolders;
    }

    get cFiles(): number {
        return this._cFiles;
    }

    get flags(): number {
        return this._flags;
    }

    get setID(): number {
        return this._setID;
    }

    get iCabinet(): number {
        return this._iCabinet;
    }

    get cbCFHeader(): number {
        return this._cbCFHeader;
    }

    get cbCFFolder(): number {
        return this._cbCFFolder;
    }

    get cbCFData(): number {
        return this._cbCFData;
    }

    get abReserve(): Buffer | null {
        return this._abReserve;
    }

    get szCabinetPrev(): string | null {
        return this._szCabinetPrev;
    }

    get szDiskPrev(): string | null {
        return this._szDiskPrev;
    }

    get szCabinetNext(): string | null {
        return this._szCabinetNext;
    }

    get szDiskNext(): string | null {
        return this._szDiskNext;
    }
}
