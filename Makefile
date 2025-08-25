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

.PHONY: clean
clean:
	rm ./codegen/*.ts

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

.PHONY: testnet/reset
testnet/reset: testnet/reset/mockreceiver testnet/reset/registry testnet/reset/tokens

.PHONY: testnet/reset/api
testnet/reset/api:
	make -C contracts/api testnet/reset

.PHONY: testnet/reset/mockreceiver
testnet/reset/mockreceiver:
	make -C contracts/mockreceiver testnet/reset

.PHONY: testnet/reset/registry
testnet/reset/registry:
	make -C contracts/registry testnet/reset

.PHONY: testnet/reset/tokens
testnet/reset/tokens:
	make -C contracts/tokens testnet/reset

.PHONY: testnet/setup
testnet/setup: codegen
	bun run testnet/setup.ts

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
	bun install --frozen-lockfile

.PHONY: check
check: cppcheck jscheck

.PHONY: cppcheck
cppcheck:
	clang-format --dry-run --Werror contracts/**/src/*.cpp contracts/**/include/**/*.hpp shared/include/antelope/*.hpp

.PHONY: jscheck
jscheck: node_modules
	@${BIN}/eslint test --ext .ts --max-warnings 0 --format unix && echo "Ok"

test: build/debug codegen node_modules 
	bun test

# CODEGEN

.PHONY: codegen
codegen: ./codegen/api.ts ./codegen/mockreceiver.ts ./codegen/registry.ts ./codegen/token.ts ./codegen/tokens.ts

./codegen/api.ts:
	${BIN}/wharfkit generate --json ./contracts/api/build/api.abi --file ./codegen/api.ts api

./codegen/mockreceiver.ts:
	${BIN}/wharfkit generate --json ./contracts/mockreceiver/build/mockreceiver.abi --file ./codegen/mockreceiver.ts mockreceiver

./codegen/registry.ts:
	${BIN}/wharfkit generate --json ./contracts/registry/build/registry.abi --file ./codegen/registry.ts registry

./codegen/token.ts:
	${BIN}/wharfkit generate --json ./shared/include/eosio.token/eosio.token.abi --file ./codegen/token.ts token

./codegen/tokens.ts:
	${BIN}/wharfkit generate --json ./contracts/tokens/build/tokens.abi --file ./codegen/tokens.ts tokens
