#!/bin/bash
include ../../.env
include ../cdt.mk
SHELL := /bin/bash
TEST_FILES := $(shell find src -name '*.ts')
BIN := ./node_modules/.bin

INCLUDES = -I include -I ../../shared/include

build: check/cdt | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${SENTIMENT_CONTRACT_NAME}.abi -o build/${SENTIMENT_CONTRACT_NAME}.wasm src/${SENTIMENT_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/debug: check/cdt | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${SENTIMENT_CONTRACT_NAME}.abi -o build/${SENTIMENT_CONTRACT_NAME}.wasm src/${SENTIMENT_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/production: check/cdt | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${SENTIMENT_CONTRACT_NAME}.abi -o build/${SENTIMENT_CONTRACT_NAME}.wasm src/${SENTIMENT_CONTRACT_NAME}.cpp -R src ${INCLUDES}

build/dir:
	mkdir -p build

clean:
	rm -rf build

testnet:
	@test -f build/${SENTIMENT_CONTRACT_NAME}.wasm -a -f build/${SENTIMENT_CONTRACT_NAME}.abi || { \
		echo "No build artifacts in $(CURDIR)/build."; \
		echo "Run 'make build/sentiment/debug' from the repository root first."; \
		exit 1; \
	}
	cleos -u $(TESTNET_NODE_URL) set contract $(SENTIMENT_TESTNET_ACCOUNT) \
		build/ ${SENTIMENT_CONTRACT_NAME}.wasm ${SENTIMENT_CONTRACT_NAME}.abi

mainnet:
	@test -f build/${SENTIMENT_CONTRACT_NAME}.wasm -a -f build/${SENTIMENT_CONTRACT_NAME}.abi || { \
		echo "No build artifacts in $(CURDIR)/build."; \
		echo "Run 'make build/sentiment/debug' from the repository root first."; \
		exit 1; \
	}
	cleos -u $(MAINNET_NODE_URL) set contract $(SENTIMENT_MAINNET_ACCOUNT) \
		build/ ${SENTIMENT_CONTRACT_NAME}.wasm ${SENTIMENT_CONTRACT_NAME}.abi
