/// <reference types="node" />
import * as streams from 'stream';
import { CFFile } from './cffile';
declare const METHOD_PARSE_HEADER: unique symbol;
declare const METHOD_PARSE_FOLDERS: unique symbol;
declare const METHOD_PARSE_HEADER_PAD: unique symbol;
declare const METHOD_PARSE_FILES: unique symbol;
declare const METHOD_PARSE_DATAS: unique symbol;
export interface IExtractListeners {
    on(event: "entry", listener: (file: CFFile, stream: streams.Readable, next: () => void) => void): this;
}
export declare class Extract extends streams.Writable implements IExtractListeners {
    private _destroyed;
    private _partial;
    private _totalReadBytes;
    private _parsers;
    private _buffer;
    private _cbCabinet;
    private _cfheader;
    private _cffolders;
    private _cffiles;
    private _readFolderIndex;
    private _curFolder;
    private _curCfData;
    private _curExtractContext;
    constructor(opts?: any);
    private [METHOD_PARSE_HEADER];
    private [METHOD_PARSE_FOLDERS];
    private [METHOD_PARSE_HEADER_PAD];
    private [METHOD_PARSE_FILES];
    private [METHOD_PARSE_DATAS];
    _write(chunk: any, encoding: string, callback: (error?: (Error | null)) => void): void;
    _final(callback: (error?: (Error | null)) => void): void;
    destroy(err?: Error): void;
}
export {};
//# sourceMappingURL=extract.d.ts.map