#!/bin/bash
include ../../.env
SHELL := /bin/bash
TEST_FILES := $(shell find src -name '*.ts')
BIN := ./node_modules/.bin

INCLUDES = -I include -I ../../shared/include

build: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${REGISTRY_CONTRACT_NAME}.abi -o build/${REGISTRY_CONTRACT_NAME}.wasm src/${REGISTRY_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/debug: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${REGISTRY_CONTRACT_NAME}.abi -o build/${REGISTRY_CONTRACT_NAME}.wasm src/${REGISTRY_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/production: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${REGISTRY_CONTRACT_NAME}.abi -o build/${REGISTRY_CONTRACT_NAME}.wasm src/${REGISTRY_CONTRACT_NAME}.cpp -R src ${INCLUDES}

build/dir:
	mkdir -p build

clean:
	rm -rf build

testnet: build/debug
	cleos -u $(TESTNET_NODE_URL) set contract $(REGISTRY_TESTNET_ACCOUNT) \
		build/ ${REGISTRY_CONTRACT_NAME}.wasm ${REGISTRY_CONTRACT_NAME}.abi