#!/bin/bash
include ../../.env
SHELL := /bin/bash
TEST_FILES := $(shell find src -name '*.ts')
BIN := ./node_modules/.bin

INCLUDES = -I include -I ../../shared/include

build: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${LIGHTACCT_CONTRACT_NAME}.abi -o build/${LIGHTACCT_CONTRACT_NAME}.wasm src/${LIGHTACCT_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/debug: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${LIGHTACCT_CONTRACT_NAME}.abi -o build/${LIGHTACCT_CONTRACT_NAME}.wasm src/${LIGHTACCT_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/production: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${LIGHTACCT_CONTRACT_NAME}.abi -o build/${LIGHTACCT_CONTRACT_NAME}.wasm src/${LIGHTACCT_CONTRACT_NAME}.cpp -R src ${INCLUDES}

build/dir:
	mkdir -p build

clean:
	rm -rf build

testnet: build/debug
	cleos -u $(TESTNET_NODE_URL) set contract $(LIGHTACCT_TESTNET_ACCOUNT) \
		build/ ${LIGHTACCT_CONTRACT_NAME}.wasm ${LIGHTACCT_CONTRACT_NAME}.abi
