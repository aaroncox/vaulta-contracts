import {beforeEach, describe, expect, test} from 'bun:test'

import {
    contracts,
    coreSymbol,
    getBalance,
    getConfig,
    getCredentialId,
    getCredentials,
    keyhostAccount,
    resetContracts,
    systemContract,
    testKey1,
    tokenContract,
} from './setup'
import {blockchain} from '../helpers'

describe('contract: lightacct - Init', () => {
    beforeEach(async () => {
        await blockchain.resetTables()
        blockchain.createAccounts('alice', 'bob', keyhostAccount)
    })

    describe('action: init', () => {
        describe('success', () => {
            test('initializes contract config', async () => {
                await contracts.lightacct.actions
                    .init([keyhostAccount, coreSymbol, tokenContract, systemContract])
                    .send()

                const rows = getConfig()
                expect(rows).toHaveLength(1)
                expect(String(rows[0].keyhost)).toBe(keyhostAccount)
                expect(String(rows[0].core_symbol)).toBe(coreSymbol)
                expect(String(rows[0].token_contract)).toBe(tokenContract)
                expect(String(rows[0].system_contract)).toBe(systemContract)
                expect(Number(rows[0].next_credential_id)).toBe(3)
            })
        })

        describe('error', () => {
            test('non-owner cannot initialize', async () => {
                await expect(
                    contracts.lightacct.actions
                        .init([keyhostAccount, coreSymbol, tokenContract, systemContract])
                        .send('alice')
                ).rejects.toThrow('missing required authority')
            })

            test('cannot initialize twice', async () => {
                await contracts.lightacct.actions
                    .init([keyhostAccount, coreSymbol, tokenContract, systemContract])
                    .send()

                await expect(
                    contracts.lightacct.actions
                        .init([keyhostAccount, coreSymbol, tokenContract, systemContract])
                        .send()
                ).rejects.toThrow('eosio_assert: contract already initialized')
            })
        })
    })

    describe('action: reset', () => {
        test('resets all contract state', async () => {
            await resetContracts()

            await contracts.token.actions
                .transfer(['alice', 'lightacct', '100.0000 A', testKey1])
                .send('alice')

            const credId = getCredentialId(testKey1)

            expect(getConfig()).toHaveLength(1)
            expect(getCredentials()).toHaveLength(1)
            expect(getBalance(credId)).toHaveLength(1)

            await contracts.lightacct.actions.reset().send()

            expect(getConfig()).toHaveLength(0)
            expect(getCredentials()).toHaveLength(0)
            expect(getBalance(credId)).toHaveLength(0)
        })

        test('non-owner cannot reset', async () => {
            await expect(contracts.lightacct.actions.reset().send('alice')).rejects.toThrow(
                'missing required authority'
            )
        })
    })
})
