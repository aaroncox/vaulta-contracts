#!/bin/bash
include ../../.env
SHELL := /bin/bash

INCLUDES = -I include -I ../../shared/include

build: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/mocksystem.abi -o build/mocksystem.wasm src/mocksystem.cpp -R src ${INCLUDES} -D DEBUG

build/debug: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/mocksystem.abi -o build/mocksystem.wasm src/mocksystem.cpp -R src ${INCLUDES} -D DEBUG

build/production: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/mocksystem.abi -o build/mocksystem.wasm src/mocksystem.cpp -R src ${INCLUDES}

build/dir:
	mkdir -p build

clean:
	rm -rf build
