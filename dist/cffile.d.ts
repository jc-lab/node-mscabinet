import ReadBuffer from './read-buffer';
import { ParseResult } from './internals';
export declare class CFFile {
    private _cbFile;
    private _uoffFolderStart;
    private _iFolder;
    private _date;
    private _time;
    private _attribs;
    private _szName;
    private _parseStep;
    parse(buffer: ReadBuffer): Promise<ParseResult>;
    readonly cbFile: number;
    readonly uoffFolderStart: number;
    readonly iFolder: number;
    readonly date: number;
    readonly time: number;
    readonly attribs: number;
    readonly szName: string;
    readonly name: string;
}
//# sourceMappingURL=cffile.d.ts.map