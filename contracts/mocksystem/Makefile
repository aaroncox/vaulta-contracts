#!/bin/bash
include ../../.env
include ../cdt.mk
SHELL := /bin/bash
BIN := ./node_modules/.bin

INCLUDES = -I include -I ../../shared/include

build: check/cdt | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${MOCKSYSTEM_CONTRACT_NAME}.abi -o build/${MOCKSYSTEM_CONTRACT_NAME}.wasm src/${MOCKSYSTEM_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/debug: check/cdt | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${MOCKSYSTEM_CONTRACT_NAME}.abi -o build/${MOCKSYSTEM_CONTRACT_NAME}.wasm src/${MOCKSYSTEM_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/production: check/cdt | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${MOCKSYSTEM_CONTRACT_NAME}.abi -o build/${MOCKSYSTEM_CONTRACT_NAME}.wasm src/${MOCKSYSTEM_CONTRACT_NAME}.cpp -R src ${INCLUDES}

build/dir:
	mkdir -p build

clean:
	rm -rf build
