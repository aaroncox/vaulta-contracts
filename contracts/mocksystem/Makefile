#!/bin/bash
include ../../.env
SHELL := /bin/bash
BIN := ./node_modules/.bin

INCLUDES = -I include -I ../../shared/include

build: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${MOCKSYSTEM_CONTRACT_NAME}.abi -o build/${MOCKSYSTEM_CONTRACT_NAME}.wasm src/${MOCKSYSTEM_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/debug: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${MOCKSYSTEM_CONTRACT_NAME}.abi -o build/${MOCKSYSTEM_CONTRACT_NAME}.wasm src/${MOCKSYSTEM_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/production: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${MOCKSYSTEM_CONTRACT_NAME}.abi -o build/${MOCKSYSTEM_CONTRACT_NAME}.wasm src/${MOCKSYSTEM_CONTRACT_NAME}.cpp -R src ${INCLUDES}

build/dir:
	mkdir -p build

clean:
	rm -rf build
