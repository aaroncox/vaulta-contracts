# Vaulta Contracts

This repository contains the following contracts:

1. **API**: Provides read-only API methods to retrieve account, token, and network information.
2. **Registry**: Registration, payment processing, and indexing of tokens on the network.
3. **Tokens**: A token contract following the eosio.token standard that allows multiple tokens.

## Building

Docker is the only requirement. Every build runs inside a container holding the Antelope CDT release pinned by `CDT_VERSION` in `.env`, installed from the official release package on a base image pinned by digest.

```
make build/<name>/production
```

Artifacts land in `contracts/<name>/build/`. `make build/<name>/debug` produces what the test suite uses, and `make build/production` or `make build/debug` builds every contract in one container. Hosts on arm64, including Apple Silicon, run the image emulated, which is slower and produces identical output.

The container is what makes the output reproducible, and the pinned version alone is not enough: CDT compiles its wasm C library differently depending on the operating system it was built on, so a CDT of the same version compiled locally on macOS produces different bytes than the published Linux package. Comparing a build against a deployed contract is covered in `contracts/create/README.md`.

## Deploying

`make testnet/<name>` and `make mainnet/create` build through the container and then deploy with `cleos`, which runs on the host and needs an unlocked wallet. Account names and node URLs come from `.env`.