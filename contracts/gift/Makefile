#!/bin/bash
include ../../.env
SHELL := /bin/bash
BIN := ./node_modules/.bin

INCLUDES = -I include -I ../../shared/include

build: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${GIFT_CONTRACT_NAME}.abi -o build/${GIFT_CONTRACT_NAME}.wasm src/${GIFT_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/debug: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${GIFT_CONTRACT_NAME}.abi -o build/${GIFT_CONTRACT_NAME}.wasm src/${GIFT_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/production: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${GIFT_CONTRACT_NAME}.abi -o build/${GIFT_CONTRACT_NAME}.wasm src/${GIFT_CONTRACT_NAME}.cpp -R src ${INCLUDES}

build/dir:
	mkdir -p build

clean:
	rm -rf build

testnet: build/debug
	cleos -u $(TESTNET_NODE_URL) set contract $(GIFT_TESTNET_ACCOUNT) \
		build/ ${GIFT_CONTRACT_NAME}.wasm ${GIFT_CONTRACT_NAME}.abi
