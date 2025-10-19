#!/bin/bash
include ../../.env
SHELL := /bin/bash
TEST_FILES := $(shell find src -name '*.ts')
BIN := ./node_modules/.bin

INCLUDES = -I include -I ../../shared/include

build: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${CREATE_CONTRACT_NAME}.abi -o build/${CREATE_CONTRACT_NAME}.wasm src/${CREATE_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/debug: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${CREATE_CONTRACT_NAME}.abi -o build/${CREATE_CONTRACT_NAME}.wasm src/${CREATE_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/production: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${CREATE_CONTRACT_NAME}.abi -o build/${CREATE_CONTRACT_NAME}.wasm src/${CREATE_CONTRACT_NAME}.cpp -R src ${INCLUDES}

build/dir:
	mkdir -p build

clean:
	rm -rf build

testnet: build/debug
	cleos -u $(TESTNET_NODE_URL) set contract $(CREATE_TESTNET_ACCOUNT) \
		build/ ${CREATE_CONTRACT_NAME}.wasm ${CREATE_CONTRACT_NAME}.abi
