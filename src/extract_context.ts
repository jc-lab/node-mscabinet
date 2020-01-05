import {CFFolder} from "./cffolder";
import * as LzxDecoderModule from './lzx_decoder'
import * as LzxDecoderNative from './lzx_decoder_native';

interface IMszipContext {
    dictionary: Buffer | null;
}
interface ILzxContext {
    module: LzxDecoderNative.Module,
    decoder: LzxDecoderNative.Module.LzxDecoder;
    index: number;
}

export class ExtractContext {
    private folder_: CFFolder;
    public dataCount: number = 0;
    private lzx_: ILzxContext | null = null;
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

    async getLzx(): Promise<ILzxContext> {
        if(!this.lzx_) {
            const module = await LzxDecoderModule.getModule();
            const ctx = this.lzx_ = {
                module,
                decoder: new module.LzxDecoder(),
                index: 0
            };
            let rc = ctx.decoder.init((this.folder_.typeCompress >> 8) & 0xff);
            if(rc != LzxDecoderModule.ARCHIVE_OK) {
                throw new Error("LzxDecoder.init failed: " + rc);
            }
        }
        return Promise.resolve(this.lzx_);
    }

}
