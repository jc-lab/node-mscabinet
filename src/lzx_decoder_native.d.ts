
export declare namespace Module {
    export interface ILzxDecoderDecodeOutput {
        result: number;
        in_bytes: number;
        out_bytes: number;
    }
    export class LzxDecoder {
        cleanupBitstream(): void;
        init(w_bits: number): number;
        decode(input: Buffer | undefined, last: number): ILzxDecoderDecodeOutput;
        getOutputBuffer(length?: number): Uint8Array;
        outputBufferTranslation(length: number, offset: number): void;
        get totalOut(): number;
    }
}

export declare interface Module {
    LzxDecoder: new () => Module.LzxDecoder;
}

export declare class EmModule {
    then(cb: (mod: Module) => void): void;
}

declare function fn(): EmModule;
export default fn;
