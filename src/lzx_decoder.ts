import WaitSignal from 'wait-signal';
import LzxDecoderNative, { Module } from './lzx_decoder_native'

const initSignal: WaitSignal = new WaitSignal();
let nativeModule!: Module;

export const ARCHIVE_EOF = 1;
export const ARCHIVE_OK = 0;
export const ARCHIVE_FAILED = -25;
export const ARCHIVE_FATAL = -30;

LzxDecoderNative().then(mod => {
    delete (mod as any).then;
    delete (mod as any).run;
    nativeModule = mod;
    initSignal.signal();
});

export async function getModule(): Promise<Module> {
    await initSignal.wait();
    return nativeModule;
}
