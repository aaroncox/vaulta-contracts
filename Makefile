BIN := ./node_modules/.bin
SHELL := /bin/bash

# CONTRACT BUILD

build: build/api/production build/registry/production

build/debug: build/api/debug build/registry/debug

build/production: build/api/production build/registry/production

build/api:
	make -C contracts/api build

build/api/debug:
	make -C contracts/api build/debug

build/api/production:
	make -C contracts/api build/production

build/registry:
	make -C contracts/registry build

build/registry/debug:
	make -C contracts/registry build/debug

build/registry/production:
	make -C contracts/registry build/production

# UNIT TESTS

test/api: build/api/debug node_modules codegen
	bun test -t "contract: api"

test/registry: build/registry/debug node_modules codegen
	bun test -t "contract: registry"

node_modules:
	make -C contracts/api node_modules

.PHONY: check
check: cppcheck jscheck

.PHONY: cppcheck
cppcheck:
	make -C contracts/api cppcheck

.PHONY: jscheck
jscheck: node_modules
	@${BIN}/eslint test --ext .ts --max-warnings 0 --format unix && echo "Ok"

test: build/debug codegen node_modules 
	bun test

# CODEGEN

.PHONY: codegen
codegen: codegen/api codegen/registry

codegen/api:
	npx @wharfkit/cli generate --json ./contracts/api/build/api.abi --file ./codegen/api.ts api

codegen/registry:
	npx @wharfkit/cli generate --json ./contracts/registry/build/registry.abi --file ./codegen/registry.ts registry