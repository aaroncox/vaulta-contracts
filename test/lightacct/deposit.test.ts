import {beforeEach, describe, expect, test} from 'bun:test'

import {
    alice,
    bob,
    contracts,
    getBalance,
    getBalanceAmount,
    getConfig,
    getCredentialId,
    getCredentials,
    lightacctContract,
    resetContracts,
    testKey1,
    testKey2,
    tokenContract,
} from './setup'
import {Asset} from '@wharfkit/antelope'
import {blockchain} from '../helpers'

describe('contract: lightacct - Deposits', () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('on_transfer: new account creation', () => {
        describe('success', () => {
            test('deposit creates credential and credits balance', async () => {
                await contracts.token.actions
                    .transfer([alice, lightacctContract, '100.0000 A', testKey1])
                    .send(alice)

                const credentials = getCredentials()
                expect(credentials).toHaveLength(1)

                const credId = getCredentialId(testKey1)
                const balances = getBalance(credId)
                expect(balances).toHaveLength(1)

                const balance = Asset.from(balances[0].balance)
                expect(Number(balance.value)).toBeLessThan(100)
                expect(Number(balance.value)).toBeGreaterThan(0)
            })

            test('first deposit deducts RAM cost from credited balance', async () => {
                await contracts.token.actions
                    .transfer([alice, lightacctContract, '100.0000 A', testKey1])
                    .send(alice)

                const credId = getCredentialId(testKey1)
                const balance = getBalanceAmount(credId)
                expect(balance).not.toBeNull()
                expect(Number(balance!.value)).toBeLessThan(100)
            })

            test('deposit to different key creates new credential', async () => {
                await contracts.token.actions
                    .transfer([alice, lightacctContract, '100.0000 A', testKey1])
                    .send(alice)

                await contracts.token.actions
                    .transfer([bob, lightacctContract, '100.0000 A', testKey2])
                    .send(bob)

                const credentials = getCredentials()
                expect(credentials).toHaveLength(2)
            })

            test('credential IDs increment sequentially', async () => {
                await contracts.token.actions
                    .transfer([alice, lightacctContract, '100.0000 A', testKey1])
                    .send(alice)
                await contracts.token.actions
                    .transfer([alice, lightacctContract, '100.0000 A', testKey2])
                    .send(alice)

                const config = getConfig()
                const credId1 = getCredentialId(testKey1)
                const credId2 = getCredentialId(testKey2)
                expect(Number(config[0].next_credential_id)).toBe(credId2 + 1)
                expect(credId2).toBe(credId1 + 1)
            })
        })
    })

    describe('on_transfer: deposit to existing account', () => {
        describe('success', () => {
            test('second deposit to same key reuses credential', async () => {
                await contracts.token.actions
                    .transfer([alice, lightacctContract, '100.0000 A', testKey1])
                    .send(alice)

                await contracts.token.actions
                    .transfer([bob, lightacctContract, '50.0000 A', testKey1])
                    .send(bob)

                const credentials = getCredentials()
                expect(credentials).toHaveLength(1)
            })

            test('second deposit does not deduct RAM cost', async () => {
                await contracts.token.actions
                    .transfer([alice, lightacctContract, '100.0000 A', testKey1])
                    .send(alice)

                const credId = getCredentialId(testKey1)
                const balanceBefore = getBalanceAmount(credId)!

                await contracts.token.actions
                    .transfer([bob, lightacctContract, '50.0000 A', testKey1])
                    .send(bob)

                const balanceAfter = getBalanceAmount(credId)!
                expect(Number(balanceAfter.value) - Number(balanceBefore.value)).toBe(50)
            })

            test('multiple deposits accumulate balance', async () => {
                await contracts.token.actions
                    .transfer([alice, lightacctContract, '100.0000 A', testKey1])
                    .send(alice)

                const credId = getCredentialId(testKey1)
                const balanceAfterFirst = getBalanceAmount(credId)!

                await contracts.token.actions
                    .transfer([bob, lightacctContract, '50.0000 A', testKey1])
                    .send(bob)

                const balanceAfterSecond = getBalanceAmount(credId)!
                expect(Number(balanceAfterSecond.value)).toBe(Number(balanceAfterFirst.value) + 50)
            })
        })
    })

    describe('on_transfer: deposit validation', () => {
        describe('error', () => {
            test('rejects deposit with empty memo', async () => {
                await expect(
                    contracts.token.actions
                        .transfer([alice, lightacctContract, '100.0000 A', ''])
                        .send(alice)
                ).rejects.toThrow('eosio_assert: memo must contain the recipient public key')
            })

            test('rejects deposit with invalid memo', async () => {
                await expect(
                    contracts.token.actions
                        .transfer([alice, lightacctContract, '100.0000 A', 'not-a-key'])
                        .send(alice)
                ).rejects.toThrow(
                    'eosio_assert: memo must be a public key (EOS... or PUB_K1_... or PUB_R1_...)'
                )
            })

            test('rejects deposit of wrong token symbol', async () => {
                const supply = '1000000000.0000 Z'
                await contracts.token.actions.create([tokenContract, supply]).send()
                await contracts.token.actions.issue([tokenContract, supply, '']).send()
                await contracts.token.actions
                    .transfer([tokenContract, alice, '100.0000 Z', ''])
                    .send()

                await expect(
                    contracts.token.actions
                        .transfer([alice, lightacctContract, '10.0000 Z', testKey1])
                        .send(alice)
                ).rejects.toThrow('eosio_assert: deposits only accepted in configured token symbol')
            })

            test('rejects zero amount deposit', async () => {
                await expect(
                    contracts.token.actions
                        .transfer([alice, lightacctContract, '0.0000 A', testKey1])
                        .send(alice)
                ).rejects.toThrow()
            })

            test('rejects deposit insufficient to cover RAM', async () => {
                await expect(
                    contracts.token.actions
                        .transfer([alice, lightacctContract, '0.0001 A', testKey1])
                        .send(alice)
                ).rejects.toThrow('eosio_assert: deposit insufficient to cover network fees (RAM)')
            })

            test('ignores transfers to other accounts', async () => {
                await contracts.token.actions
                    .transfer([alice, bob, '50.0000 A', testKey1])
                    .send(alice)
            })

            test('rejects deposit from unauthorized token contract', async () => {
                const fakeToken = 'faketokens'
                blockchain.createAccounts(fakeToken)
                blockchain.createContract(
                    fakeToken,
                    './shared/include/eosio.token/eosio.token',
                    true
                )
                await new Promise((r) => setTimeout(r, 0))

                const fakeContract = blockchain.getAccount(fakeToken)!

                const supply = '1000000000.0000 A'
                await fakeContract.actions.create([fakeToken, supply]).send()
                await fakeContract.actions.issue([fakeToken, supply, '']).send()
                await fakeContract.actions.transfer([fakeToken, alice, '1000.0000 A', '']).send()

                await expect(
                    fakeContract.actions
                        .transfer([alice, lightacctContract, '100.0000 A', testKey1])
                        .send(alice)
                ).rejects.toThrow(
                    'eosio_assert: deposits only accepted from configured token contract'
                )
            })
        })
    })
})
