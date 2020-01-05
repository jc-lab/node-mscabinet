/// <reference types="node" />
import * as streams from 'stream';
import ReadBuffer from './read-buffer';
import { ParseResult } from './internals';
import { CFHeader } from './cfheader';
import { ExtractContext } from "./extract_context";
export declare class CFData {
    private _cfHeader;
    private _extractContext;
    private _index;
    private _csum;
    private _cbData;
    private _cbUncomp;
    private _abReserve;
    private _compData;
    private _checkBuffer;
    private _checkBufferOffset;
    private _computedCsum;
    private _uncompData;
    private _parseStep;
    constructor(cfHeader: CFHeader, extractContext: ExtractContext, index: number);
    parse(buffer: ReadBuffer, outputSteram: streams.Writable): Promise<ParseResult>;
    uncompressMszip(outputSteram: streams.Writable): Promise<void>;
}
//# sourceMappingURL=cfdata.d.ts.map