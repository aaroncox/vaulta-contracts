#!/bin/bash
include ../../.env
SHELL := /bin/bash
TEST_FILES := $(shell find src -name '*.ts')
BIN := ./node_modules/.bin

INCLUDES = -I include -I ../../shared/include -I ../tokens/include -I ../registry/include

build: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${MOCKRECEIVER_CONTRACT_NAME}.abi -o build/${MOCKRECEIVER_CONTRACT_NAME}.wasm src/${MOCKRECEIVER_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/debug: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${MOCKRECEIVER_CONTRACT_NAME}.abi -o build/${MOCKRECEIVER_CONTRACT_NAME}.wasm src/${MOCKRECEIVER_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/production: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${MOCKRECEIVER_CONTRACT_NAME}.abi -o build/${MOCKRECEIVER_CONTRACT_NAME}.wasm src/${MOCKRECEIVER_CONTRACT_NAME}.cpp -R src ${INCLUDES}

build/dir:
	mkdir -p build

clean:
	rm -rf build

testnet: build/debug
	cleos -u $(TESTNET_NODE_URL) set contract $(MOCKRECEIVER_TESTNET_ACCOUNT) \
		build/ ${MOCKRECEIVER_CONTRACT_NAME}.wasm ${MOCKRECEIVER_CONTRACT_NAME}.abi

.PHONY: testnet/reset
testnet/reset:
	cleos -u $(TESTNET_NODE_URL) push action $(MOCKRECEIVER_TESTNET_ACCOUNT) reset '{}' -p $(MOCKRECEIVER_TESTNET_ACCOUNT)@active
