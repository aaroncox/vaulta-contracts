import {beforeEach, describe, expect, test} from 'bun:test'

import {alice, bob, contracts, registryContract, resetContracts, tokensContract} from '../helpers'
import {Asset, Name} from '@wharfkit/antelope'

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

                expect(
                    contracts.tokens.actions.close([alice, '4,FOO']).send(alice)
                ).rejects.toThrow(`eosio_assert: Cannot close because the balance is not zero.`)
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
                const contractAccountsTable = await contracts.tokens.tables
                    .accounts(Name.from(tokensContract).value.value)
                    .getTableRows()
                expect(contractAccountsTable).toHaveLength(1)
                expect(contractAccountsTable[0].balance).toBe('100.0000 FOO')
                await contracts.tokens.actions
                    .transfer([tokensContract, alice, '50.0000 FOO', 'memo'])
                    .send(tokensContract)
                const aliceAccountsTable = await contracts.tokens.tables
                    .accounts(Name.from(alice).value.value)
                    .getTableRows()
                expect(aliceAccountsTable).toHaveLength(1)
                expect(aliceAccountsTable[0].balance).toBe('50.0000 FOO')
                await contracts.tokens.actions
                    .transfer([alice, bob, '20.0000 FOO', 'memo'])
                    .send(alice)
                const aliceAccountsTableAfter = await contracts.tokens.tables
                    .accounts(Name.from(alice).value.value)
                    .getTableRows()
                expect(aliceAccountsTableAfter).toHaveLength(1)
                expect(aliceAccountsTableAfter[0].balance).toBe('30.0000 FOO')
                const bobAccountsTableAfter = await contracts.tokens.tables
                    .accounts(Name.from(bob).value.value)
                    .getTableRows()
                expect(bobAccountsTableAfter).toHaveLength(1)
                expect(bobAccountsTableAfter[0].balance).toBe('20.0000 FOO')
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
                await expect(
                    contracts.tokens.actions.setconfig([registryContract]).send(alice)
                ).rejects.toThrow(`missing required authority ${tokensContract}`)
            })
        })
    })

    describe('action: setsupply', () => {
        describe('success', () => {
            test('setsupply allocates supply to contract and adds stats', async () => {
                await contracts.token.actions
                    .transfer([alice, registryContract, '50.0000 A', ''])
                    .send(alice)
                await contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)
                await contracts.registry.actions.setcontract(['FOO', tokensContract]).send(alice)
                await contracts.tokens.actions.setsupply(['FOO', '100.0000 FOO']).send(alice)

                // Check that the token was created in the tokens contract
                const stats = await contracts.tokens.tables
                    .stat(Asset.SymbolCode.from('FOO').value.value)
                    .getTableRows()
                expect(stats).toHaveLength(1)
                expect(stats[0].supply).toBe('100.0000 FOO')
                expect(stats[0].max_supply).toBe('100.0000 FOO')
                expect(stats[0].issuer).toBe(registryContract)

                // Ensure the entire supply is allocated to the contract
                const contractBalance = await contracts.tokens.tables
                    .accounts(Name.from(tokensContract).value.value)
                    .getTableRows()
                expect(contractBalance).toHaveLength(1)
                expect(contractBalance[0].balance).toBe('100.0000 FOO')
            })
        })
        describe('error', () => {
            test('ticker must match supply symbol', async () => {
                await contracts.token.actions
                    .transfer([alice, registryContract, '50.0000 A', ''])
                    .send(alice)
                await contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)
                await contracts.registry.actions.setcontract(['FOO', tokensContract]).send(alice)

                await expect(
                    contracts.tokens.actions.setsupply(['FOO', '100.0000 BAR']).send(alice)
                ).rejects.toThrow('eosio_assert: ticker must match supply symbol')
            })
            test('registry must be defined in config', async () => {
                await contracts.tokens.actions.reset([[], []]).send()
                await expect(
                    contracts.tokens.actions.setsupply(['FOO', '100.0000 FOO']).send(alice)
                ).rejects.toThrow('registry contract not set')
            })
            test('token must be set to use this contract', async () => {
                await contracts.token.actions
                    .transfer([alice, registryContract, '50.0000 A', ''])
                    .send(alice)
                await contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)

                await expect(
                    contracts.tokens.actions.setsupply(['FOO', '100.0000 FOO']).send(alice)
                ).rejects.toThrow('token is not registered to this contract')
            })
            test('token must be registered in registry', async () => {
                await expect(
                    contracts.tokens.actions.setsupply(['FOO', '100.0000 FOO']).send(alice)
                ).rejects.toThrow('eosio_assert: token is not registered in registry contract')
            })
            test('requires authority of creator from registry contract', async () => {
                await contracts.token.actions
                    .transfer([alice, registryContract, '50.0000 A', ''])
                    .send(alice)
                await contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)
                await contracts.registry.actions.setcontract(['FOO', tokensContract]).send(alice)

                await expect(
                    contracts.tokens.actions.setsupply(['FOO', '100.0000 FOO']).send(bob)
                ).rejects.toThrow(`missing required authority ${alice}`)
            })
            test('token supply must be greater than 0', async () => {
                await contracts.token.actions
                    .transfer([alice, registryContract, '50.0000 A', ''])
                    .send(alice)
                await contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)
                await contracts.registry.actions.setcontract(['FOO', tokensContract]).send(alice)

                await expect(
                    contracts.tokens.actions.setsupply(['FOO', '0.0000 FOO']).send(alice)
                ).rejects.toThrow('eosio_assert: max-supply must be positive')
            })
            test('cannot call twice', async () => {
                await contracts.token.actions
                    .transfer([alice, registryContract, '50.0000 A', ''])
                    .send(alice)
                await contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)
                await contracts.registry.actions.setcontract(['FOO', tokensContract]).send(alice)

                await contracts.tokens.actions.setsupply(['FOO', '100.0000 FOO']).send(alice)

                await expect(
                    contracts.tokens.actions.setsupply(['FOO', '100.0000 FOO']).send(alice)
                ).rejects.toThrow('eosio_assert: token supply has already been set')
            })
        })
    })

    describe('action: distribute', () => {
        describe('success', () => {
            test('distributes the token', async () => {
                await contracts.token.actions
                    .transfer([alice, registryContract, '50.0000 A', ''])
                    .send(alice)
                await contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)
                await contracts.registry.actions.setcontract(['FOO', tokensContract]).send(alice)
                await contracts.tokens.actions.setsupply(['FOO', '100.0000 FOO']).send(alice)

                // Open required balances for alice and bob
                await contracts.tokens.actions.open([alice, '4,FOO', alice]).send(alice)
                await contracts.tokens.actions.open([bob, '4,FOO', alice]).send(alice)

                // Check opened balances
                const aliceOpenedBalance = await contracts.tokens.tables
                    .accounts(Name.from(alice).value.value)
                    .getTableRows()
                expect(aliceOpenedBalance).toHaveLength(1)
                expect(aliceOpenedBalance[0].balance).toBe('0.0000 FOO')

                const bobOpenedBalance = await contracts.tokens.tables
                    .accounts(Name.from(bob).value.value)
                    .getTableRows()
                expect(bobOpenedBalance).toHaveLength(1)
                expect(bobOpenedBalance[0].balance).toBe('0.0000 FOO')

                // Distribute the token
                await contracts.tokens.actions
                    .distribute([
                        'FOO',
                        [
                            {
                                receiver: alice,
                                quantity: '90.0000 FOO',
                            },
                            {
                                receiver: bob,
                                quantity: '10.0000 FOO',
                            },
                        ],
                    ])
                    .send(alice)

                const contractBalance = await contracts.tokens.tables
                    .accounts(Name.from(tokensContract).value.value)
                    .getTableRows()
                expect(contractBalance).toHaveLength(1)
                expect(contractBalance[0].balance).toBe('0.0000 FOO')

                const aliceBalance = await contracts.tokens.tables
                    .accounts(Name.from(alice).value.value)
                    .getTableRows()
                expect(aliceBalance).toHaveLength(1)
                expect(aliceBalance[0].balance).toBe('90.0000 FOO')

                const bobBalance = await contracts.tokens.tables
                    .accounts(Name.from(bob).value.value)
                    .getTableRows()
                expect(bobBalance).toHaveLength(1)
                expect(bobBalance[0].balance).toBe('10.0000 FOO')
            })
        })
        describe('error', () => {
            test('must provide at least one allocation', async () => {
                await contracts.token.actions
                    .transfer([alice, registryContract, '50.0000 A', ''])
                    .send(alice)
                await contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)
                await contracts.registry.actions.setcontract(['FOO', tokensContract]).send(alice)
                await contracts.tokens.actions.setsupply(['FOO', '100.0000 FOO']).send(alice)
                await contracts.tokens.actions.open([alice, '4,FOO', alice]).send(alice)
                await contracts.tokens.actions.open([bob, '4,FOO', alice]).send(alice)

                expect(
                    contracts.tokens.actions.distribute(['FOO', []]).send(alice)
                ).rejects.toThrow('eosio_assert: must provide at least one token allocation')
            })
            test('cannot provide 0 balance allocation', async () => {
                await contracts.token.actions
                    .transfer([alice, registryContract, '50.0000 A', ''])
                    .send(alice)
                await contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)
                await contracts.registry.actions.setcontract(['FOO', tokensContract]).send(alice)
                await contracts.tokens.actions.setsupply(['FOO', '100.0000 FOO']).send(alice)
                await contracts.tokens.actions.open([alice, '4,FOO', alice]).send(alice)
                await contracts.tokens.actions.open([bob, '4,FOO', alice]).send(alice)

                expect(
                    contracts.tokens.actions
                        .distribute([
                            'FOO',
                            [
                                {
                                    receiver: alice,
                                    quantity: '0.0000 FOO',
                                },
                                {
                                    receiver: bob,
                                    quantity: '100.0000 FOO',
                                },
                            ],
                        ])
                        .send(alice)
                ).rejects.toThrow('eosio_assert: must allocate an amount greater than zero')
            })
            test('ticker must match allocations', async () => {
                await contracts.token.actions
                    .transfer([alice, registryContract, '50.0000 A', ''])
                    .send(alice)
                await contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)
                await contracts.registry.actions.setcontract(['FOO', tokensContract]).send(alice)
                await contracts.tokens.actions.setsupply(['FOO', '100.0000 FOO']).send(alice)
                await contracts.tokens.actions.open([alice, '4,FOO', alice]).send(alice)
                await contracts.tokens.actions.open([bob, '4,FOO', alice]).send(alice)

                expect(
                    contracts.tokens.actions
                        .distribute([
                            'FOO',
                            [
                                {
                                    receiver: alice,
                                    quantity: '100.0000 BAR',
                                },
                            ],
                        ])
                        .send(alice)
                ).rejects.toThrow('eosio_assert: allocation symbol does not match supply symbol')

                expect(
                    contracts.tokens.actions
                        .distribute([
                            'FOO',
                            [
                                {
                                    receiver: alice,
                                    quantity: '10.0000 FOO',
                                },
                                {
                                    receiver: bob,
                                    quantity: '10.0000 BAR',
                                },
                            ],
                        ])
                        .send(alice)
                ).rejects.toThrow('eosio_assert: allocation symbol does not match supply symbol')
            })
            test('supply must be established', async () => {
                await contracts.token.actions
                    .transfer([alice, registryContract, '50.0000 A', ''])
                    .send(alice)
                await contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)
                await contracts.registry.actions.setcontract(['FOO', tokensContract]).send(alice)
                // await contracts.tokens.actions.open([alice, '4,FOO', alice]).send(alice)
                // await contracts.tokens.actions.open([bob, '4,FOO', alice]).send(alice)

                expect(
                    contracts.tokens.actions
                        .distribute([
                            'FOO',
                            [
                                {
                                    receiver: alice,
                                    quantity: '100.0000 BAR',
                                },
                            ],
                        ])
                        .send(alice)
                ).rejects.toThrow('eosio_assert: supply not established')
            })
            test('registry must be defined in config', async () => {
                await contracts.tokens.actions.reset([[], []]).send()
                await expect(
                    contracts.tokens.actions.setsupply(['FOO', '100.0000 FOO']).send(alice)
                ).rejects.toThrow('registry contract not set')
            })
            test('token must be registered in registry', async () => {
                await contracts.token.actions
                    .transfer([alice, registryContract, '50.0000 A', ''])
                    .send(alice)
                await contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)
                await contracts.registry.actions.setcontract(['FOO', tokensContract]).send(alice)
                await contracts.tokens.actions.setsupply(['FOO', '100.0000 FOO']).send(alice)
                await contracts.tokens.actions.open([alice, '4,FOO', alice]).send(alice)
                await contracts.tokens.actions.open([bob, '4,FOO', alice]).send(alice)
                expect(
                    contracts.tokens.actions
                        .distribute([
                            'BAR',
                            [
                                {
                                    receiver: bob,
                                    quantity: '10.0000 BAR',
                                },
                            ],
                        ])
                        .send(alice)
                ).rejects.toThrow('eosio_assert: token is not registered in registry contract')
            })
            test('requires authority of creator from registry contract', async () => {
                await contracts.token.actions
                    .transfer([alice, registryContract, '50.0000 A', ''])
                    .send(alice)
                await contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)
                await contracts.registry.actions.setcontract(['FOO', tokensContract]).send(alice)
                await contracts.tokens.actions.setsupply(['FOO', '100.0000 FOO']).send(alice)
                await contracts.tokens.actions.open([alice, '4,FOO', alice]).send(alice)

                expect(
                    contracts.tokens.actions
                        .distribute([
                            'FOO',
                            [
                                {
                                    receiver: alice,
                                    quantity: '100.0000 FOO',
                                },
                            ],
                        ])
                        .send(bob)
                ).rejects.toThrow(`missing required authority ${alice}`)
            })
            test('allocations must equal the total supply', async () => {
                await contracts.token.actions
                    .transfer([alice, registryContract, '50.0000 A', ''])
                    .send(alice)
                await contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)
                await contracts.registry.actions.setcontract(['FOO', tokensContract]).send(alice)
                await contracts.tokens.actions.setsupply(['FOO', '100.0000 FOO']).send(alice)
                await contracts.tokens.actions.open([alice, '4,FOO', alice]).send(alice)
                await contracts.tokens.actions.open([bob, '4,FOO', alice]).send(alice)

                expect(
                    contracts.tokens.actions
                        .distribute([
                            'FOO',
                            [
                                {
                                    receiver: alice,
                                    quantity: '90.0000 FOO',
                                },
                            ],
                        ])
                        .send(alice)
                ).rejects.toThrow(
                    `eosio_assert: invalid token distribution: total allocations must match the supply`
                )

                expect(
                    contracts.tokens.actions
                        .distribute([
                            'FOO',
                            [
                                {
                                    receiver: alice,
                                    quantity: '40.0000 FOO',
                                },
                                {
                                    receiver: bob,
                                    quantity: '10.0000 FOO',
                                },
                            ],
                        ])
                        .send(alice)
                ).rejects.toThrow(
                    `eosio_assert: invalid token distribution: total allocations must match the supply`
                )
            })
            test('cannot call twice', async () => {
                await contracts.token.actions
                    .transfer([alice, registryContract, '50.0000 A', ''])
                    .send(alice)
                await contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)
                await contracts.registry.actions.setcontract(['FOO', tokensContract]).send(alice)
                await contracts.tokens.actions.setsupply(['FOO', '100.0000 FOO']).send(alice)
                await contracts.tokens.actions.open([alice, '4,FOO', alice]).send(alice)
                await contracts.tokens.actions.open([bob, '4,FOO', alice]).send(alice)
                await contracts.tokens.actions
                    .distribute([
                        'FOO',
                        [
                            {
                                receiver: alice,
                                quantity: '100.0000 FOO',
                            },
                        ],
                    ])
                    .send(alice)

                expect(
                    contracts.tokens.actions
                        .distribute([
                            'FOO',
                            [
                                {
                                    receiver: alice,
                                    quantity: '100.0000 FOO',
                                },
                            ],
                        ])
                        .send(alice)
                ).rejects.toThrow('eosio_assert: token has already been distributed')
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
                await expect(
                    contracts.tokens.actions
                        .issuefixed([tokensContract, '1.0000 FOO', 'memo'])
                        .send(alice)
                ).rejects.toThrow(`missing required authority ${tokensContract}`)
            })
        })
        describe('action: setmaxsupply', () => {
            test('require contract auth', async () => {
                await contracts.tokens.actions.create([tokensContract, '100.0000 FOO']).send()
                await expect(
                    contracts.tokens.actions
                        .setmaxsupply([tokensContract, '200.0000 FOO'])
                        .send(alice)
                ).rejects.toThrow(`missing required authority ${tokensContract}`)
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
                await expect(
                    contracts.tokens.actions.retire(['10.0000 FOO', 'memo']).send(alice)
                ).rejects.toThrow(`missing required authority ${tokensContract}`)
            })
        })
    })
})
