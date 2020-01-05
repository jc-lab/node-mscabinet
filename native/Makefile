all: lzx_decoder.js

lzx_decoder.js:
	em++ -O3 lzx_decoder.cpp binding.cpp -o ../src/lzx_decoder_native.js --bind -s WASM=0 -s SINGLE_FILE=1 -s MODULARIZE=1 -s ASSERTIONS=1 -std=c++11 -g
