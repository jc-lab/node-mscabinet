import {CFFolder} from "./cffolder";

interface IMszipContext {
    dictionary: Buffer | null;
}

export abstract class ExtractContext {
    private folder_: CFFolder;
    public dataCount: number = 0;
    private mszip_: IMszipContext | null = null;

    constructor(folder: CFFolder) {
        this.folder_ = folder;
    }

    get folder(): CFFolder {
        return this.folder_;
    }

    getMszip(): IMszipContext {
        if(!this.mszip_) {
            this.mszip_ = {
                dictionary: null
            };
        }
        return this.mszip_;
    }

    abstract consumeData(data: Buffer): Promise<void>;
}
