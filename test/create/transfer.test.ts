import {beforeEach, describe, expect, test} from 'bun:test'
import {Asset, Name} from '@wharfkit/antelope'

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
