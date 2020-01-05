/// <reference types="node" />
import { CFFolder } from "./cffolder";
interface IMszipContext {
    dictionary: Buffer | null;
}
export declare class ExtractContext {
    private folder_;
    dataCount: number;
    private mszip_;
    constructor(folder: CFFolder);
    readonly folder: CFFolder;
    getMszip(): IMszipContext;
}
export {};
//# sourceMappingURL=extract_context.d.ts.map