#!/bin/bash
include ../../.env
SHELL := /bin/bash
BIN := ./node_modules/.bin

INCLUDES = -I include -I ../../shared/include

build/debug: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${GIFT_CONTRACT_NAME}.abi -o build/${GIFT_CONTRACT_NAME}.wasm src/${GIFT_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/production: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${GIFT_CONTRACT_NAME}.abi -o build/${GIFT_CONTRACT_NAME}.wasm src/${GIFT_CONTRACT_NAME}.cpp -R src ${INCLUDES}

build/dir:
	mkdir -p build

clean:
	rm -rf build

testnet:
	@test -f build/${GIFT_CONTRACT_NAME}.wasm -a -f build/${GIFT_CONTRACT_NAME}.abi || { \
		echo "No build artifacts in $(CURDIR)/build."; \
		echo "Run 'make build/gift/debug' from the repository root first."; \
		exit 1; \
	}
	cleos -u $(TESTNET_NODE_URL) set contract $(GIFT_TESTNET_ACCOUNT) \
		build/ ${GIFT_CONTRACT_NAME}.wasm ${GIFT_CONTRACT_NAME}.abi
