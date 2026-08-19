#!/bin/bash
include ../../.env
include ../cdt.mk
SHELL := /bin/bash
TEST_FILES := $(shell find src -name '*.ts')
BIN := ./node_modules/.bin

INCLUDES = -I include -I ../../shared/include

build: check/cdt | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${CREATE_CONTRACT_NAME}.abi -o build/${CREATE_CONTRACT_NAME}.wasm src/${CREATE_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/debug: check/cdt | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${CREATE_CONTRACT_NAME}.abi -o build/${CREATE_CONTRACT_NAME}.wasm src/${CREATE_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/production: check/cdt | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${CREATE_CONTRACT_NAME}.abi -o build/${CREATE_CONTRACT_NAME}.wasm src/${CREATE_CONTRACT_NAME}.cpp -R src ${INCLUDES}

build/dir:
	mkdir -p build

clean:
	rm -rf build

testnet: build/debug
	cleos -u $(TESTNET_NODE_URL) set contract $(CREATE_TESTNET_ACCOUNT) \
		build/ ${CREATE_CONTRACT_NAME}.wasm ${CREATE_CONTRACT_NAME}.abi

mainnet: build/production
	@test -n "$(CREATE_MAINNET_ACCOUNT)" || { echo "CREATE_MAINNET_ACCOUNT is not set in .env"; exit 1; }
	@echo "Deploying ${CREATE_CONTRACT_NAME} to $(CREATE_MAINNET_ACCOUNT) on $(MAINNET_NODE_URL)"
	cleos -u $(MAINNET_NODE_URL) set contract $(CREATE_MAINNET_ACCOUNT) \
		build/ ${CREATE_CONTRACT_NAME}.wasm ${CREATE_CONTRACT_NAME}.abi
