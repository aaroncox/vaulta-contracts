BIN := ./node_modules/.bin
SHELL := /bin/bash

# CONTRACT BUILD

build: build/production

build/debug: build/api/debug build/mockreceiver/debug build/registry/debug build/tokens/debug

build/production: build/api/production build/registry/production build/tokens/production

build/api:
	make -C contracts/api build

build/api/debug:
	make -C contracts/api build/debug

build/api/production:
	make -C contracts/api build/production

build/mockreceiver:
	make -C contracts/mockreceiver build

build/mockreceiver/debug:
	make -C contracts/mockreceiver build/debug

build/mockreceiver/production:
	make -C contracts/mockreceiver build/production	

build/registry:
	make -C contracts/registry build

build/registry/debug:
	make -C contracts/registry build/debug

build/registry/production:
	make -C contracts/registry build/production

build/tokens:
	make -C contracts/tokens build

build/tokens/debug:
	make -C contracts/tokens build/debug

build/tokens/production:
	make -C contracts/tokens build/production

# TESTNET

.PHONY: testnet
testnet: testnet/api testnet/mockreceiver testnet/registry testnet/tokens

.PHONY: testnet/api
testnet/api:
	make -C contracts/api testnet

.PHONY: testnet/mockreceiver
testnet/mockreceiver:
	make -C contracts/mockreceiver testnet

.PHONY: testnet/registry
testnet/registry:
	make -C contracts/registry testnet

.PHONY: testnet/tokens
testnet/tokens:
	make -C contracts/tokens testnet

# UNIT TESTS

test/api: build/api/debug node_modules codegen
	bun test -t "contract: api"

test/mockreceiver: build/mockreceiver/debug node_modules codegen
	bun test -t "contract: mockreceiver"

test/registry: build/registry/debug node_modules codegen
	bun test -t "contract: registry"

test/tokens: build/tokens/debug node_modules codegen
	bun test -t "contract: tokens"

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
codegen: codegen/api codegen/registry codegen/token codegen/tokens

codegen/api:
	npx @wharfkit/cli generate --json ./contracts/api/build/api.abi --file ./codegen/api.ts api

codegen/registry:
	npx @wharfkit/cli generate --json ./contracts/registry/build/registry.abi --file ./codegen/registry.ts registry

codegen/token:
	npx @wharfkit/cli generate --json ./shared/include/eosio.token/eosio.token.abi --file ./codegen/token.ts token

codegen/tokens:
	npx @wharfkit/cli generate --json ./contracts/tokens/build/tokens.abi --file ./codegen/tokens.ts tokens
