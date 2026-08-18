// Live-chain check of create-contract key permutations (mirrors test/create/transfer.test.ts); run: bun testnet/verify-create.ts [--dry-run]

import {
    APIClient,
    Asset,
    Base58,
    Bytes,
    Name,
    PrivateKey,
    PublicKey,
} from '@wharfkit/antelope'
import {Chains, Session} from '@wharfkit/session'
import {WalletPluginPrivateKey} from '@wharfkit/wallet-plugin-privatekey'

const DRY_RUN = process.argv.includes('--dry-run')

const PAYMENT_TOKEN_CONTRACT = 'core.vaulta'
const PAYMENT_SYMBOL = '4,A'
const BYTES_FOR_CREATION = 3260
const BUFFER_UNITS = 500 // 0.0500 A over estimate; excess refunds to the new account

for (const required of ['TESTNET_NODE_URL', 'CREATE_TESTNET_ACCOUNT']) {
    if (!process.env[required]) throw new Error(`${required} is not set in .env`)
}
if (!DRY_RUN) {
    if (!process.env.TESTNET_TEST_ACCOUNT) {
        throw new Error('TESTNET_TEST_ACCOUNT is not set in .env')
    }
    if (!process.env.TESTNET_PRIVATE_KEY) {
        throw new Error('TESTNET_PRIVATE_KEY is not set in .env.local (gitignored; keep private keys out of .env)')
    }
}

const client = new APIClient({url: process.env.TESTNET_NODE_URL})
const createAccount = process.env.CREATE_TESTNET_ACCOUNT
const payer = process.env.TESTNET_TEST_ACCOUNT

// ---- key fixtures, generated fresh per run (mirrors test/create/transfer.test.ts) ----

const k1Private = PrivateKey.generate('K1')
const k1ForLegacy = PrivateKey.generate('K1')
const r1Private = PrivateKey.generate('R1')

const legacyKey = k1ForLegacy.toPublic().toLegacyString()
const k1Key = String(k1Private.toPublic())
const r1Key = String(r1Private.toPublic())
const longRpid = 'a'.repeat(90) + '.subdomain.example.com'

const waPoint = PrivateKey.generate('K1').toPublic().data.array
function makeWaKey(presence: number, rpid: string): string {
    const rpidBytes = new TextEncoder().encode(rpid)
    const payload = new Uint8Array([...waPoint, presence, rpidBytes.length, ...rpidBytes])
    return 'PUB_WA_' + Base58.encodeRipemd160Check(Bytes.from(payload), 'WA')
}
function mutateWaKey(waKey: string, mutate: (raw: number[]) => number[]): string {
    const raw = Array.from(Base58.decode(waKey.slice('PUB_WA_'.length)).array)
    return 'PUB_WA_' + Base58.encode(Bytes.from(new Uint8Array(mutate(raw))))
}

const NAME_FIRST = 'abcdefghijklmnopqrstuvwxyz'
const NAME_REST = NAME_FIRST + '12345'
function randomName(length = 12): string {
    let name = NAME_FIRST[Math.floor(Math.random() * NAME_FIRST.length)]
    while (name.length < length) {
        name += NAME_REST[Math.floor(Math.random() * NAME_REST.length)]
    }
    return name
}

// ---- cost estimation (mirrors shared/include/antelope/ram.cpp) ----

async function estimateCost(): Promise<Asset> {
    const result = await client.v1.chain.get_table_rows({
        code: 'eosio',
        scope: 'eosio',
        table: 'rammarket',
        json: true,
    })
    const base = Asset.from(result.rows[0].base.balance).units.toNumber()
    const quote = Asset.from(result.rows[0].quote.balance).units.toNumber()
    const cost = Math.floor((quote * BYTES_FOR_CREATION) / (base - BYTES_FOR_CREATION))
    const fee = Math.floor((cost + 199) / 200)
    return Asset.fromUnits(cost + fee, Asset.Symbol.from(PAYMENT_SYMBOL))
}

// ---- cases ----

interface PositiveCase {
    label: string
    key: string
}
interface NegativeCase {
    label: string
    memo: (name: string) => string
    expectError: string
}

const positiveCases: PositiveCase[] = [
    {label: 'legacy EOS key', key: legacyKey},
    {label: 'PUB_K1 key', key: k1Key},
    {label: 'PUB_R1 key', key: r1Key},
]
for (const presence of [0, 1, 2]) {
    for (const rpid of ['example.com', longRpid]) {
        positiveCases.push({
            label: `PUB_WA presence=${presence} rpid=${rpid === '' ? '(empty)' : rpid.length > 20 ? `(${rpid.length} chars)` : rpid}`,
            key: makeWaKey(presence, rpid),
        })
    }
}

const negativeCases: NegativeCase[] = [
    {
        label: 'legacy key with corrupted checksum',
        memo: (name) => `${name}-${legacyKey.slice(0, -1) + (legacyKey.endsWith('W') ? 'V' : 'W')}`,
        expectError: 'Invalid public key checksum',
    },
    {
        label: 'PUB_K1 key with corrupted checksum',
        memo: (name) => `${name}-${k1Key.slice(0, -1) + (k1Key.endsWith('5') ? '6' : '5')}`,
        expectError: 'Invalid public key checksum',
    },
    {
        label: 'PUB_R1 key with corrupted checksum',
        memo: (name) => `${name}-${r1Key.slice(0, -1) + (r1Key.endsWith('C') ? 'D' : 'C')}`,
        expectError: 'Invalid public key checksum',
    },
    {
        label: 'PUB_WA key with corrupted checksum byte',
        memo: (name) =>
            `${name}-${mutateWaKey(makeWaKey(1, 'example.com'), (raw) => {
                raw[raw.length - 1] ^= 0x01
                return raw
            })}`,
        expectError: 'Invalid public key checksum',
    },
    {
        label: 'PUB_WA key with truncated payload',
        memo: (name) =>
            `${name}-${mutateWaKey(makeWaKey(1, 'example.com'), (raw) => {
                raw.splice(raw.length - 5, 1)
                return raw
            })}`,
        expectError: 'Invalid public key length',
    },
    {
        label: 'PUB_WA key with extra trailing bytes',
        memo: (name) =>
            `${name}-${mutateWaKey(makeWaKey(1, 'example.com'), (raw) => {
                raw.push(0)
                return raw
            })}`,
        expectError: 'Invalid public key length',
    },
    {
        // contract accepts empty rpid; nodeos rejects it at key deserialization
        label: 'PUB_WA key with empty rpid (upstream nodeos rule)',
        memo: (name) => `${name}-${makeWaKey(1, '')}`,
        expectError: 'webauthn pubkey must have non empty rpid',
    },
    {
        label: 'memo without separator',
        memo: () => 'invalidmemo',
        expectError: 'Invalid memo format',
    },
    {
        label: 'insufficient payment',
        memo: (name) => `${name}-${k1Key}`,
        expectError: 'is required to pay for account creation costs',
    },
    {
        label: 'short name (upstream auction rule)',
        memo: () => `${randomName(4)}-${k1Key}`,
        expectError: 'no active bid for name',
    },
]

// ---- execution ----

const cost = await estimateCost()
const payment = Asset.fromUnits(
    cost.units.toNumber() + BUFFER_UNITS,
    Asset.Symbol.from(PAYMENT_SYMBOL)
)
const total = Asset.fromUnits(
    payment.units.toNumber() * positiveCases.length,
    Asset.Symbol.from(PAYMENT_SYMBOL)
)

console.log(`node:            ${process.env.TESTNET_NODE_URL}`)
console.log(`create contract: ${createAccount}`)
console.log(`estimated cost:  ${cost} per account, sending ${payment} each`)
console.log(`positive cases:  ${positiveCases.length} (total spend ~${total})`)
console.log(`negative cases:  ${negativeCases.length}`)

if (DRY_RUN) {
    for (const c of positiveCases) console.log(`  [create] ${c.label}: ${c.key}`)
    for (const c of negativeCases) console.log(`  [reject] ${c.label}`)
    process.exit(0)
}

const balances = await client.v1.chain.get_currency_balance(PAYMENT_TOKEN_CONTRACT, payer!, 'A')
const balance = balances[0] ? Asset.from(balances[0]) : undefined
console.log(`payer:           ${payer} (${balance ?? '0.0000 A'})`)
if (!balance || balance.units.toNumber() < total.units.toNumber()) {
    throw new Error(`Insufficient A balance on ${payer}: need ~${total}`)
}

const session = new Session({
    chain: {id: Chains.Jungle4.id, url: process.env.TESTNET_NODE_URL},
    actor: payer!,
    permission: 'active',
    walletPlugin: new WalletPluginPrivateKey(process.env.TESTNET_PRIVATE_KEY!),
})

function transferAction(quantity: Asset, memo: string) {
    return {
        account: PAYMENT_TOKEN_CONTRACT,
        name: 'transfer',
        authorization: [{actor: payer!, permission: 'active'}],
        data: {from: payer!, to: createAccount, quantity, memo},
    }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
let failures = 0

for (const c of positiveCases) {
    const name = randomName()
    process.stdout.write(`[create] ${c.label} -> ${name} ... `)
    try {
        const result = await session.transact({action: transferAction(payment, `${name}-${c.key}`)})
        await sleep(1500)
        const account = await client.v1.chain.get_account(name)
        const expected = PublicKey.from(c.key)
        for (const permission of ['owner', 'active']) {
            const perm = account.permissions.find((p) => String(p.perm_name) === permission)
            const keys = perm?.required_auth.keys
            if (!keys || keys.length !== 1 || !keys[0].key.equals(expected)) {
                throw new Error(`${permission} authority mismatch: ${JSON.stringify(keys)}`)
            }
        }
        const refund = await client.v1.chain.get_currency_balance(PAYMENT_TOKEN_CONTRACT, name, 'A')
        console.log(
            `ok (tx ${String(result.resolved!.transaction.id).slice(0, 8)}, refund ${refund[0] ?? 'none'})`
        )
    } catch (error) {
        failures++
        console.log(`FAIL\n         ${error}`)
    }
    await sleep(500)
}

let existingAccount: string | undefined
for (const c of negativeCases) {
    const name = randomName()
    const quantity =
        c.label === 'insufficient payment'
            ? Asset.fromUnits(1, Asset.Symbol.from(PAYMENT_SYMBOL))
            : payment
    process.stdout.write(`[reject] ${c.label} ... `)
    try {
        await session.transact({action: transferAction(quantity, c.memo(name))})
        failures++
        console.log(`FAIL: transaction unexpectedly succeeded`)
    } catch (error) {
        const message = String(error)
        if (message.includes(c.expectError)) {
            console.log('ok (rejected as expected)')
        } else {
            failures++
            console.log(`FAIL: wrong error\n         expected "${c.expectError}"\n         got ${message}`)
        }
    }
    await sleep(500)
}

console.log(failures === 0 ? '\nAll cases passed.' : `\n${failures} case(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
