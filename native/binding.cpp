#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/vector.h>

#include "lzx_decoder.h"

std::vector<uint8_t> allocVectorBYTE(int size) {
    std::vector<uint8_t> buf;
    if(size) {
        buf.resize(size);
    }
    return buf;
}

// Binding code
EMSCRIPTEN_BINDINGS(stl_wrappers) {
    emscripten::register_vector<uint8_t>("VectorBYTE");
    emscripten::function("allocVectorBYTE", &allocVectorBYTE);
}

EMSCRIPTEN_BINDINGS(lzx_decoder_class) {
    emscripten::class_<LzxDecoder>("LzxDecoder")
        .constructor<>()
        .function("cleanupBitstream", &LzxDecoder::cleanupBitstream)
        .function("init", &LzxDecoder::init)
        .function("decode", emscripten::optional_override([](LzxDecoder& this_, const emscripten::val& input_val, int last) -> LzxDecoder::DecodeOutput {
          LzxDecoder::DecodeOutput result;
            if(input_val.isNull() || input_val.isUndefined() || input_val.isFalse()) {
                std::string empty;
                result = this_.decode(empty, last);
            }else{
                result = this_.decode(input_val.as<std::string>(), last);
            }
            return result;
        }))
        .function("getOutputBuffer", emscripten::optional_override([](LzxDecoder& this_, const emscripten::val& emval_length) -> emscripten::val {
            size_t length = this_.out_buf.size();
            if(emval_length.isNumber()) {
                length = emval_length.as<uint32_t>();
            }
            return emscripten::val(emscripten::typed_memory_view(length, this_.out_buf.data()));
        }))
        .function("outputBufferTranslation", &LzxDecoder::outputBufferTranslation)
        .property("totalOut", &LzxDecoder::getTotalOut)
        ;
    emscripten::value_object<LzxDecoder::DecodeOutput>("LzxDecoder::DecodeOutput")
        .field("result", &LzxDecoder::DecodeOutput::result)
        .field("in_bytes", &LzxDecoder::DecodeOutput::in_bytes)
        .field("out_bytes", &LzxDecoder::DecodeOutput::out_bytes);
}
