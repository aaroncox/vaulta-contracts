#!/bin/bash
include ../../.env
SHELL := /bin/bash
TEST_FILES := $(shell find src -name '*.ts')
BIN := ./node_modules/.bin

INCLUDES = -I include -I ../../shared/include -I ../registry/include

build: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${TOKENS_CONTRACT_NAME}.abi -o build/${TOKENS_CONTRACT_NAME}.wasm src/${TOKENS_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/debug: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${TOKENS_CONTRACT_NAME}.abi -o build/${TOKENS_CONTRACT_NAME}.wasm src/${TOKENS_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/production: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${TOKENS_CONTRACT_NAME}.abi -o build/${TOKENS_CONTRACT_NAME}.wasm src/${TOKENS_CONTRACT_NAME}.cpp -R src ${INCLUDES}

build/dir:
	mkdir -p build

clean:
	rm -rf build

testnet: build/debug
	cleos -u $(TESTNET_NODE_URL) set contract $(TOKENS_TESTNET_ACCOUNT) \
		build/ ${TOKENS_CONTRACT_NAME}.wasm ${TOKENS_CONTRACT_NAME}.abi

.PHONY: testnet/reset
testnet/reset:
	cleos -u $(TESTNET_NODE_URL) push action $(TOKENS_TESTNET_ACCOUNT) reset '{"testsymbols": ["2,FOO"],"testaccounts": ["eosio","gm","mockrecv.gm","teamgreymass","wharfkittest"]}' -p $(TOKENS_TESTNET_ACCOUNT)@active
