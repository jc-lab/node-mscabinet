import ReadBuffer from './read-buffer';
import {ParseResult} from './internals';

enum ParseStep {
    HEADER = 0,
    szName = 1,
    COMPLETE
}

export class CFFile {
    private _cbFile: number = 0; // UInt32LE
    private _uoffFolderStart: number = 0; // UInt32LE
    private _iFolder: number = 0; // UInt16LE
    private _date: number = 0; // UInt16LE
    private _time: number = 0; // UInt16LE
    private _attribs: number = 0; // UInt16LE
    private _szName: string = '';

    private _parseStep: ParseStep = ParseStep.HEADER;

    public parse(buffer: ReadBuffer): Promise<ParseResult> {
        switch (this._parseStep) {
            case ParseStep.HEADER:
                if (buffer.remaining < 16) {
                    return Promise.resolve(ParseResult.NEED_MORE);
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
                if(!chunk.complete) {
                    return Promise.resolve(ParseResult.NEED_MORE);
                }
            }
                this._parseStep++;

            case ParseStep.COMPLETE:
        }
        return Promise.resolve(ParseResult.DONE);
    }


    get cbFile(): number {
        return this._cbFile;
    }

    get uoffFolderStart(): number {
        return this._uoffFolderStart;
    }

    get iFolder(): number {
        return this._iFolder;
    }

    get date(): number {
        return this._date;
    }

    get time(): number {
        return this._time;
    }

    get attribs(): number {
        return this._attribs;
    }

    get szName(): string {
        return this._szName;
    }

    get name(): string {
        return this._szName;
    }
}
