import {beforeEach, describe, expect, test} from 'bun:test'

import {alice, bob, contracts, registryContract, resetContracts, tokensContract} from '../helpers'
import {Name} from '@wharfkit/antelope'

describe(`contract: ${tokensContract}`, () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('action: open', () => {
        describe('success', () => {
            test('open token for account', async () => {
                await contracts.tokens.actions.create([tokensContract, '100.0000 FOO']).send()
                await contracts.tokens.actions
                    .issue([tokensContract, '50.0000 FOO', 'memo'])
                    .send(tokensContract)
                await contracts.tokens.actions
                    .transfer([tokensContract, alice, '20.0000 FOO', 'memo'])
                    .send(tokensContract)
                await contracts.tokens.actions.open([bob, '4,FOO', bob]).send(bob)
                const bobAccountsTable = await contracts.tokens.tables
                    .accounts(Name.from(bob).value.value)
                    .getTableRows()
                expect(bobAccountsTable).toHaveLength(1)
                expect(bobAccountsTable[0].balance).toBe('0.0000 FOO')
            })
        })
    })

    describe('action: close', () => {
        describe('success', () => {
            test('close token for account', async () => {
                await contracts.tokens.actions.create([tokensContract, '100.0000 FOO']).send()
                await contracts.tokens.actions
                    .issue([tokensContract, '50.0000 FOO', 'memo'])
                    .send(tokensContract)
                await contracts.tokens.actions
                    .transfer([tokensContract, alice, '20.0000 FOO', 'memo'])
                    .send(tokensContract)
                await contracts.tokens.actions.open([bob, '4,FOO', bob]).send(bob)
                const bobAccountsTable = await contracts.tokens.tables
                    .accounts(Name.from(bob).value.value)
                    .getTableRows()
                expect(bobAccountsTable).toHaveLength(1)
                expect(bobAccountsTable[0].balance).toBe('0.0000 FOO')
                await contracts.tokens.actions.close([bob, '4,FOO']).send(bob)
                const bobAccountsTableAfter = await contracts.tokens.tables
                    .accounts(Name.from(bob).value.value)
                    .getTableRows()
                expect(bobAccountsTableAfter).toHaveLength(0)
            })
        })
        describe('error', () => {
            test('cannot close account with non-zero balance', async () => {
                await contracts.tokens.actions.create([tokensContract, '100.0000 FOO']).send()
                await contracts.tokens.actions
                    .issue([tokensContract, '50.0000 FOO', 'memo'])
                    .send(tokensContract)
                await contracts.tokens.actions
                    .transfer([tokensContract, alice, '20.0000 FOO', 'memo'])
                    .send(tokensContract)

                const action = contracts.tokens.actions.close([alice, '4,FOO']).send(alice)

                await expect(action).rejects.toThrow(
                    `eosio_assert: Cannot close because the balance is not zero.`
                )
            })
        })
    })

    describe('action: transfer', () => {
        describe('success', () => {
            test('transfer tokens between accounts', async () => {
                await contracts.tokens.actions.create([tokensContract, '100.0000 FOO']).send()
                await contracts.tokens.actions
                    .issue([tokensContract, '100.0000 FOO', 'memo'])
                    .send(tokensContract)
                await contracts.tokens.actions
                    .transfer([tokensContract, alice, '50.0000 FOO', 'memo'])
                    .send(tokensContract)
                await contracts.tokens.actions
                    .transfer([alice, bob, '20.0000 FOO', 'memo'])
                    .send(alice)
            })
        })
    })

    describe('action: setconfig', () => {
        describe('success', () => {
            test('set registry contract', async () => {
                await contracts.tokens.actions.setconfig(['foo']).send()
                const rows = await contracts.tokens.tables.config().getTableRows()
                expect(rows).toHaveLength(1)
                expect(rows[0].registry).toBe('foo')
            })
        })
        describe('error', () => {
            test('require contract auth', async () => {
                const action = contracts.tokens.actions.setconfig([registryContract]).send(alice)
                expect(action).rejects.toThrow(`missing required authority ${tokensContract}`)
            })
        })
    })

    describe('standard errors', () => {
        describe('action: create', () => {
            test('require contract auth', async () => {
                const action = contracts.tokens.actions
                    .create([registryContract, '1.0000 FOO'])
                    .send(registryContract)
                expect(action).rejects.toThrow(`missing required authority ${tokensContract}`)
            })
        })
        describe('action: issue', () => {
            test('require contract auth', async () => {
                await contracts.tokens.actions.create([tokensContract, '100.0000 FOO']).send()
                const action = contracts.tokens.actions
                    .issue([tokensContract, '100.0000 FOO', 'memo'])
                    .send(alice)
                expect(action).rejects.toThrow(`missing required authority ${tokensContract}`)
            })
        })
        describe('action: issuefixed', () => {
            test('require contract auth', async () => {
                await contracts.tokens.actions.create([tokensContract, '1.0000 FOO']).send()
                const action = contracts.tokens.actions
                    .issuefixed([tokensContract, '1.0000 FOO', 'memo'])
                    .send(alice)
                expect(action).rejects.toThrow(`missing required authority ${tokensContract}`)
            })
        })
        describe('action: setmaxsupply', () => {
            test('require contract auth', async () => {
                await contracts.tokens.actions.create([tokensContract, '100.0000 FOO']).send()
                const action = contracts.tokens.actions
                    .setmaxsupply([tokensContract, '200.0000 FOO'])
                    .send(alice)
                expect(action).rejects.toThrow(`missing required authority ${tokensContract}`)
            })
        })
        describe('action: retire', () => {
            test('require contract auth', async () => {
                await contracts.tokens.actions.create([tokensContract, '100.0000 FOO']).send()
                await contracts.tokens.actions
                    .issue([tokensContract, '100.0000 FOO', 'memo'])
                    .send(tokensContract)
                await contracts.tokens.actions
                    .transfer([tokensContract, alice, '50.0000 FOO', 'memo'])
                    .send(tokensContract)
                const action = contracts.tokens.actions.retire(['10.0000 FOO', 'memo']).send(alice)
                expect(action).rejects.toThrow(`missing required authority ${tokensContract}`)
            })
        })
    })
})
