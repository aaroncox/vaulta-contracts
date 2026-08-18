import {beforeEach, describe, expect, test} from 'bun:test'
import {Asset, Base58, Bytes, Name, PublicKey} from '@wharfkit/antelope'

import {
    alice,
    contracts,
    createContract,
    legacyTokenSymbol,
    resetContracts,
    systemTokenContract,
    validMemo,
} from './setup'

function getBalance(key: string, account: string, symbol: string): Asset | undefined {
    const scope = Name.from(account).value.value
    const primaryKey = Asset.Symbol.from(symbol).code.value.value
    const row = contracts[key].tables.accounts(scope).getTableRow(primaryKey)
    return row ? Asset.from(row.balance) : undefined
}

describe('contract: create - Transfer Handling', () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('rejection of incorrect tokens', () => {
        test('rejects EOS (eosio.token) transfer with a valid creation memo', async () => {
            await expect(
                contracts.legacytoken.actions
                    .transfer([alice, createContract, '1.0757 EOS', validMemo])
                    .send(alice)
            ).rejects.toThrow(
                'This contract only accepts tokens from the designated token contract.'
            )
        })

        test('rejects fake A token from an unauthorized contract', async () => {
            await expect(
                contracts.faketoken.actions
                    .transfer([alice, createContract, '1.0000 A', validMemo])
                    .send(alice)
            ).rejects.toThrow(
                'This contract only accepts tokens from the designated token contract.'
            )
        })
    })

    describe('core.vaulta transfers still dispatch', () => {
        test('rejects A transfer with an invalid memo', async () => {
            await expect(
                contracts.token.actions
                    .transfer([alice, createContract, '1.0000 A', 'invalidmemo'])
                    .send(alice)
            ).rejects.toThrow('eosio_assert: Invalid memo format')
        })
    })

    describe('system token unwrap leg', () => {
        test('accepts the eosio.token EOS leg core.vaulta sends back during buyram', async () => {
            await contracts.legacytoken.actions
                .transfer([systemTokenContract, createContract, '1.0790 EOS', ''])
                .send(systemTokenContract)

            const balance = getBalance('legacytoken', createContract, legacyTokenSymbol)
            expect(String(balance)).toBe('1.0790 EOS')
        })
    })

    describe('public key checksum verification', () => {
        // fixed key: private 5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3
        const legacyKey = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV'
        const k1Key = 'PUB_K1_6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5BoDq63'
        const r1Key = 'PUB_R1_6RbRqL9zrcKDvSh4XYue8V9DTyku4mceghvPoPD7tjeKJmAVJB'
        const longRpid = 'a'.repeat(90) + '.subdomain.example.com'

        async function parseKey(key: string): Promise<string> {
            const traces = await contracts.create.actions.parsememo([`newuser1-${key}`]).send()
            return String(traces[0].returnValue.second.keys[0].key)
        }

        // WA payload: 33-byte point ++ presence byte ++ rpid length byte ++ rpid ascii
        const waPoint = PublicKey.from(k1Key).data.array
        function makeWaKey(presence: number, rpid: string): string {
            const rpidBytes = new TextEncoder().encode(rpid)
            const payload = new Uint8Array([...waPoint, presence, rpidBytes.length, ...rpidBytes])
            return 'PUB_WA_' + Base58.encodeRipemd160Check(Bytes.from(payload), 'WA')
        }
        function mutateWaKey(waKey: string, mutate: (raw: number[]) => number[]): string {
            const raw = Array.from(Base58.decode(waKey.slice('PUB_WA_'.length)).array)
            return 'PUB_WA_' + Base58.encode(Bytes.from(new Uint8Array(mutate(raw))))
        }

        test('accepts a valid legacy EOS key', async () => {
            expect(await parseKey(legacyKey)).toBe(String(PublicKey.from(legacyKey)))
        })

        test('rejects a legacy EOS key with a corrupted checksum', async () => {
            const corrupted = legacyKey.slice(0, -1) + 'W'
            await expect(
                contracts.create.actions.parsememo([`newuser1-${corrupted}`]).send()
            ).rejects.toThrow('eosio_assert: Invalid public key checksum')
        })

        test('accepts a valid PUB_K1 key', async () => {
            expect(await parseKey(k1Key)).toBe(k1Key)
        })

        test('rejects a PUB_K1 key with a corrupted checksum', async () => {
            const corrupted = k1Key.slice(0, -1) + '5'
            await expect(
                contracts.create.actions.parsememo([`newuser1-${corrupted}`]).send()
            ).rejects.toThrow('eosio_assert: Invalid public key checksum')
        })

        test('accepts a valid PUB_R1 key', async () => {
            expect(await parseKey(r1Key)).toBe(r1Key)
        })

        test('rejects a PUB_R1 key with a corrupted checksum', async () => {
            const corrupted = r1Key.slice(0, -1) + 'C'
            await expect(
                contracts.create.actions.parsememo([`newuser1-${corrupted}`]).send()
            ).rejects.toThrow('eosio_assert: Invalid public key checksum')
        })

        test('accepts a valid PUB_WA key', async () => {
            await contracts.create.actions.parsememo([validMemo]).send()
        })

        test('rejects a PUB_WA key with a corrupted checksum', async () => {
            const corrupted = validMemo.slice(0, -1) + (validMemo.endsWith('i') ? 'j' : 'i')
            await expect(
                contracts.create.actions.parsememo([corrupted]).send()
            ).rejects.toThrow('eosio_assert: Invalid public key checksum')
        })

        test('accepts WA keys across user presence values and rpid lengths', async () => {
            // empty rpid excluded: nodeos rejects it at key deserialization (vert does not)
            for (const presence of [0, 1, 2]) {
                for (const rpid of ['example.com', longRpid]) {
                    const key = makeWaKey(presence, rpid)
                    expect(String(PublicKey.from(key))).toBe(key)
                    expect(await parseKey(key)).toBe(key)
                }
            }
        })

        test('rejects a WA key with a corrupted checksum byte', async () => {
            const corrupted = mutateWaKey(makeWaKey(1, 'example.com'), (raw) => {
                raw[raw.length - 1] ^= 0x01
                return raw
            })
            await expect(
                contracts.create.actions.parsememo([`newuser1-${corrupted}`]).send()
            ).rejects.toThrow('eosio_assert: Invalid public key checksum')
        })

        test('rejects a WA key with a truncated payload', async () => {
            const truncated = mutateWaKey(makeWaKey(1, 'example.com'), (raw) => {
                raw.splice(raw.length - 5, 1)
                return raw
            })
            await expect(
                contracts.create.actions.parsememo([`newuser1-${truncated}`]).send()
            ).rejects.toThrow('eosio_assert: Invalid public key length')
        })

        test('rejects a WA key with extra trailing bytes', async () => {
            const extended = mutateWaKey(makeWaKey(1, 'example.com'), (raw) => {
                raw.push(0)
                return raw
            })
            await expect(
                contracts.create.actions.parsememo([`newuser1-${extended}`]).send()
            ).rejects.toThrow('eosio_assert: Invalid public key length')
        })
    })

    describe('bypass memo', () => {
        test('allows funding the contract with any token using bypass memo', async () => {
            await contracts.legacytoken.actions
                .transfer([alice, createContract, '5.0000 EOS', 'bypass'])
                .send(alice)

            const balance = getBalance('legacytoken', createContract, legacyTokenSymbol)
            expect(String(balance)).toBe('5.0000 EOS')
        })
    })
})
