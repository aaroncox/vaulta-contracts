# Account Creation Contract

A self-serve account creation contract for the Vaulta network. A user sends the network token to the contract with a memo describing the new account, and the contract creates the account, buys its RAM, and refunds any overpayment in a single transaction. Deployed as `create.gm` on Vaulta mainnet and Jungle 4, and proposed as the official `new.vaulta` network contract in [VP-0002](https://github.com/greymass/vaulta-proposals).

## How it works

1. Call the read-only `estimatecost` action to get the token cost of one creation.
2. Transfer at least that amount of `A` (the `core.vaulta` token) to the contract with the memo `accountname-PUBLICKEY`.
3. The contract creates the account with the given key as its single `owner` and `active` authority, buys the account's RAM through `core.vaulta`, and transfers any excess payment to the new account.

Rules the memo must satisfy:

- The account name must be exactly 12 characters from `a-z` and `1-5`, with no dots. Shorter names require a won name auction and dotted names require the suffix owner's authority; the system contract rejects both since this contract holds neither.
- The public key may be in legacy (`EOS...`) or standard (`PUB_K1_`, `PUB_R1_`, `PUB_WA_`) form. The 4-byte checksum in the key encoding is verified on chain; a mistyped key rejects the transaction instead of creating an unusable account.
- The name must not already exist.

Each creation buys the RAM cost of 3,260 bytes (3,000 for the account, 260 for a token balance row) plus the system market fee. Because the price can move between the estimate and the transfer, send the estimate plus a small buffer; the buffer is refunded to the new account as its starting balance.

A transfer with the memo `bypass` is accepted and retained without creating an account. This funds the contract directly; the contract has no action that moves funds out.

The created account has RAM but no CPU or NET. Its first transactions need a cosigner or a power-up, which wallets integrating this flow are expected to provide.

## Actions

| Action | Auth | Description |
|---|---|---|
| `transfer` notification | token sender | Entry point. Parses the memo, creates the account, buys RAM, refunds excess. |
| `parsememo(memo)` | none (read-only) | Parses `accountname-PUBLICKEY` into a name and single-key authority. Usable as a preflight check. |
| `estimatecost()` | none (read-only) | Returns the token cost of one creation at the market price. |
| `logcreation(account, from, excess, ram, timestamp)` | contract | Inline log emitted per creation for indexers. |

The contract stores no tables.

## Building

Requires [Antelope CDT v4.1.1](https://github.com/AntelopeIO/cdt/releases/tag/v4.1.1). The build refuses to run under any other version, since the compiler version determines the code hash. Build settings, including the pinned `CDT_VERSION`, come from the repository `.env` file.

```
make clean
make build/production
```

The output is `build/create.wasm` and `build/create.abi`.

## Verifying a deployment

Compare the sha256 of a clean local build against the on-chain code hash:

```
shasum -a 256 build/create.wasm
cleos -u https://vaulta.greymass.com get code create.gm
```

## Testing

Unit tests run against the [vert](https://github.com/eosnetworkfoundation/vert) VM:

```
make -C ../.. test/create
```

Live verification runs the full key-permutation matrix against the Jungle 4 deployment, creating real accounts and asserting each invalid variant fails with its expected error:

```
make -C ../.. testnet/create/verify
```

The live run needs `TESTNET_TEST_ACCOUNT` funded with `A` on Jungle 4 and its key in the gitignored `.env.local` as `TESTNET_PRIVATE_KEY`. Pass `--dry-run` to `testnet/verify-create.ts` to preview the cases without sending.

## Deploying

```
make -C ../.. testnet/create
make -C ../.. mainnet/create
```

Both targets build first and deploy with `cleos set contract` to the accounts named in `.env`.
