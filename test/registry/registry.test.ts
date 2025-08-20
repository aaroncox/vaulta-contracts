import {beforeEach, describe, expect, test} from 'bun:test'
import {Asset} from '@wharfkit/antelope'

import {
    alice,
    bob,
    contracts,
    defaultFeesAccount,
    defaultInitialBalance,
    defaultSystemTokenContract,
    defaultSystemTokenSymbol,
    getTokenBalance,
    registryContract,
    resetContracts,
    tokensContract,
} from '../helpers'

describe(`contract: ${registryContract}`, () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('user', () => {
        describe('notify: on_transfer', () => {
            describe('success', () => {
                test('deposit funds', async () => {
                    const balance = getTokenBalance(alice)
                    expect(balance.equals(defaultInitialBalance)).toBeTrue()

                    // Initial deposit
                    await contracts.token.actions
                        .transfer([alice, registryContract, '5.0000 A', ''])
                        .send(alice)
                    let rows = await contracts.registry.tables.balance().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].account).toBe(alice)
                    expect(rows[0].balance).toBe('5.0000 A')

                    // Ensure balance deducted correctly
                    const balanceAfterDeposit1 = getTokenBalance(alice)
                    const expectedBalanceAfterDeposit1 = defaultInitialBalance.units.subtracting(
                        Asset.fromFloat(5, defaultSystemTokenSymbol).units
                    )
                    expect(
                        balanceAfterDeposit1.units.equals(expectedBalanceAfterDeposit1)
                    ).toBeTrue()

                    // Additional deposit
                    await contracts.token.actions
                        .transfer([alice, registryContract, '3.0000 A', ''])
                        .send(alice)
                    rows = await contracts.registry.tables.balance().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].account).toBe(alice)
                    expect(rows[0].balance).toBe('8.0000 A')

                    // Ensure balance deducted correctly
                    const balanceAfterDeposit2 = getTokenBalance(alice)
                    const expectedBalanceAfterDeposit2 = expectedBalanceAfterDeposit1.subtracting(
                        Asset.fromFloat(3, defaultSystemTokenSymbol).units
                    )
                    expect(
                        balanceAfterDeposit2.units.equals(expectedBalanceAfterDeposit2)
                    ).toBeTrue()
                })
            })
            describe('error', () => {
                test('contract disabled', async () => {
                    await contracts.registry.actions.reset().send()
                    expect(
                        contracts.token.actions
                            .transfer([alice, registryContract, '5.0000 A', ''])
                            .send(alice)
                    ).rejects.toThrow('eosio_assert: contract is disabled')
                })
                test('reject incorrect token contract', async () => {
                    await expect(
                        contracts.faketoken.actions
                            .transfer([alice, registryContract, '5.0000 A', ''])
                            .send(alice)
                    ).rejects.toThrow('eosio_assert: Incorrect token contract for deposit.')
                })
                test('reject incorrect token symbol', async () => {
                    await expect(
                        contracts.token.actions
                            .transfer([alice, registryContract, '5.0000 B', ''])
                            .send(alice)
                    ).rejects.toThrow('eosio_assert: Incorrect token symbol for deposit.')
                })
            })
        })
        describe('action: withdraw', () => {
            describe('success', () => {
                test('withdraw funds', async () => {
                    const balance = getTokenBalance(alice)
                    expect(balance.equals(defaultInitialBalance)).toBeTrue()

                    // Deposit funds first
                    await contracts.token.actions
                        .transfer([alice, registryContract, '10.0000 A', ''])
                        .send(alice)

                    // Ensure contract balance updated correctly
                    const rowsAfterDeposit = await contracts.registry.tables
                        .balance()
                        .getTableRows()
                    expect(rowsAfterDeposit).toHaveLength(1)
                    expect(rowsAfterDeposit[0].account).toBe(alice)
                    expect(rowsAfterDeposit[0].balance).toBe('10.0000 A')

                    // Ensure account balance deducted correctly
                    const balanceAfterDeposit1 = getTokenBalance(alice)
                    const expectedBalanceAfterDeposit1 = defaultInitialBalance.units.subtracting(
                        Asset.fromFloat(10, defaultSystemTokenSymbol).units
                    )
                    expect(
                        balanceAfterDeposit1.units.equals(expectedBalanceAfterDeposit1)
                    ).toBeTrue()

                    // Withdraw funds from contract
                    await contracts.registry.actions.withdraw([alice, '4.0000 A']).send(alice)

                    // Ensure contract balance updated correctly
                    const rowsAfterWithdraw = await contracts.registry.tables
                        .balance()
                        .getTableRows()
                    expect(rowsAfterWithdraw).toHaveLength(1)
                    expect(rowsAfterWithdraw[0].account).toBe(alice)
                    expect(rowsAfterWithdraw[0].balance).toBe('6.0000 A')

                    // Verify token balance updated correctly
                    const balanceAfterWithdraw = getTokenBalance(alice)
                    const expectedBalanceAfterWithdraw = defaultInitialBalance.units
                        .subtracting(Asset.fromFloat(10, defaultSystemTokenSymbol).units)
                        .adding(Asset.fromFloat(4, defaultSystemTokenSymbol).units)
                    expect(
                        balanceAfterWithdraw.units.equals(expectedBalanceAfterWithdraw)
                    ).toBeTrue()
                })
            })
            describe('error', () => {
                test('contract disabled', async () => {
                    await contracts.registry.actions.reset().send()
                    await expect(
                        contracts.registry.actions.withdraw([alice, '1.0000 FOO']).send(alice)
                    ).rejects.toThrow('eosio_assert: contract is disabled')
                })
                test('no contract balance', async () => {
                    await expect(
                        contracts.registry.actions.withdraw([alice, '100.0000 A']).send(alice)
                    ).rejects.toThrow('eosio_assert: no contract balance for account')
                })
                test('insufficient contract balance', async () => {
                    await contracts.token.actions
                        .transfer([alice, registryContract, '10.0000 A', ''])
                        .send(alice)
                    await expect(
                        contracts.registry.actions.withdraw([alice, '10.0001 A']).send(alice)
                    ).rejects.toThrow('eosio_assert: insufficient contract balance')
                })
                test('incorrect token symbol', async () => {
                    await contracts.token.actions
                        .transfer([alice, registryContract, '10.0000 A', ''])
                        .send(alice)
                    await expect(
                        contracts.registry.actions.withdraw([alice, '5.0000 B']).send(alice)
                    ).rejects.toThrow('eosio_assert: Incorrect token symbol for withdraw')
                })
            })
        })
        describe('action: regtoken', () => {
            describe('success', () => {
                test('register token', async () => {
                    const balance = getTokenBalance(alice)
                    expect(balance.equals(defaultInitialBalance)).toBeTrue()

                    await contracts.registry.actions
                        .setconfig([
                            {
                                contract: defaultSystemTokenContract,
                                symbol: defaultSystemTokenSymbol,
                            },
                            {
                                receiver: defaultFeesAccount,
                                regtoken: '20.0000 A',
                            },
                        ])
                        .send()

                    await contracts.token.actions
                        .transfer([alice, registryContract, '50.0000 A', ''])
                        .send(alice)

                    // Ensure contract balance updated correctly
                    const balanceAfter = getTokenBalance(alice)
                    expect(
                        balanceAfter.units.equals(
                            defaultInitialBalance.units.subtracting(
                                Asset.fromFloat(50, defaultSystemTokenSymbol).units
                            )
                        )
                    ).toBeTrue()

                    // Ensure fee balance before transfer
                    const feeBalanceBefore = getTokenBalance(defaultFeesAccount)
                    expect(
                        feeBalanceBefore.equals(Asset.fromUnits(0, defaultSystemTokenSymbol))
                    ).toBeTrue()

                    // Register the token
                    await contracts.registry.actions
                        .regtoken([alice, 'FOO', '20.0000 A'])
                        .send(alice)

                    // Ensure token registered correctly
                    const rows = await contracts.registry.tables.tokens().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].contract).toBeNull()
                    expect(rows[0].ticker).toBe('FOO')
                    expect(rows[0].creator).toBe(alice)

                    // Ensure contract balance deducted correctly
                    const contractBalance = await contracts.registry.tables.balance().getTableRows()
                    expect(contractBalance).toHaveLength(1)
                    expect(contractBalance[0].account).toBe(alice)
                    expect(contractBalance[0].balance).toBe('30.0000 A')

                    // Ensure the fee was transferred to the fee account
                    const feeBalanceAfter = getTokenBalance(defaultFeesAccount)
                    expect(
                        feeBalanceAfter.units.equals(
                            Asset.fromFloat(20, defaultSystemTokenSymbol).units
                        )
                    ).toBeTrue()

                    // // Ensure allocations recorded correctly
                    // const allocations = await contracts.registry.tables.allocations().getTableRows()
                    // expect(allocations).toHaveLength(2)

                    // const aliceAllocation = allocations.find((a) => a.receiver === alice)
                    // expect(aliceAllocation).toBeDefined()
                    // expect(aliceAllocation.contract).toBe(tokensContract)
                    // expect(aliceAllocation.receiver).toBe(alice)
                    // expect(aliceAllocation.quantity).toBe('0.5000 FOO')

                    // const bobAllocation = allocations.find((a) => a.receiver === 'bob')
                    // expect(bobAllocation).toBeDefined()
                    // expect(bobAllocation.contract).toBe(tokensContract)
                    // expect(bobAllocation.receiver).toBe('bob')
                    // expect(bobAllocation.quantity).toBe('0.5000 FOO')

                    // // Ensure the token was created with correct supply
                    // const statsTable = await contracts.tokens.tables
                    //     .stat(Asset.SymbolCode.from('FOO').value.value)
                    //     .getTableRows()
                    // expect(statsTable).toHaveLength(1)
                    // expect(statsTable[0].supply).toBe('1.0000 FOO')
                    // expect(statsTable[0].max_supply).toBe('1.0000 FOO')
                    // expect(statsTable[0].issuer).toBe(registryContract)

                    // // Ensure the token was allocated correctly
                    // const aliceAccountsTable = await contracts.tokens.tables
                    //     .accounts(Name.from(alice).value.value)
                    //     .getTableRows()
                    // expect(aliceAccountsTable).toHaveLength(1)
                    // expect(aliceAccountsTable[0].balance).toBe('0.5000 FOO')
                    // const bobAccountsTable = await contracts.tokens.tables
                    //     .accounts(Name.from('bob').value.value)
                    //     .getTableRows()
                    // expect(bobAccountsTable).toHaveLength(1)
                    // expect(bobAccountsTable[0].balance).toBe('0.5000 FOO')
                })
            })
            describe('error', () => {
                test('contract disabled', async () => {
                    await contracts.registry.actions.reset().send()
                    // Attempt to register token
                    await expect(
                        contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)
                    ).rejects.toThrow('eosio_assert: contract is disabled')
                })
                test('incorrect payment symbol', async () => {
                    await contracts.token.actions
                        .transfer([alice, registryContract, '50.0000 A', ''])
                        .send(alice)
                    await expect(
                        contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 B']).send(alice)
                    ).rejects.toThrow('eosio_assert: incorrect payment symbol')
                })
                test('incorrect payment amount', async () => {
                    await expect(
                        contracts.registry.actions.regtoken([alice, 'FOO', '2.0000 A']).send(alice)
                    ).rejects.toThrow('eosio_assert: incorrect payment amount')
                })
                // test('token contract not on whitelist', async () => {
                //     const action = contracts.registry.actions
                //         .regtoken([alice, 'FOO', '1.0000 A'])
                //         .send(alice)

                //     expect(action).rejects.toThrow('eosio_assert: contract is not whitelisted')
                // })
                test('incorrect payment amount', async () => {
                    await contracts.registry.actions
                        .setconfig([
                            {
                                contract: defaultSystemTokenContract,
                                symbol: defaultSystemTokenSymbol,
                            },
                            {
                                receiver: defaultFeesAccount,
                                regtoken: '20.0000 A',
                            },
                        ])
                        .send()

                    await contracts.token.actions
                        .transfer([alice, registryContract, '50.0000 A', ''])
                        .send(alice)

                    const balance = getTokenBalance(alice)
                    expect(
                        balance.units.equals(
                            defaultInitialBalance.units.subtracting(
                                Asset.fromFloat(50, defaultSystemTokenSymbol).units
                            )
                        )
                    ).toBeTrue()

                    const rows = await contracts.registry.tables.balance().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].account).toBe(alice)
                    expect(rows[0].balance).toBe('50.0000 A')

                    await expect(
                        contracts.registry.actions.regtoken([alice, 'FOO', '30.0000 A']).send(alice)
                    ).rejects.toThrow('eosio_assert: incorrect payment amount')
                })
                test('insufficient contract balance to pay fee', async () => {
                    await contracts.token.actions
                        .transfer([alice, registryContract, '0.0001 A', ''])
                        .send(alice)

                    const balance = getTokenBalance(alice)
                    expect(
                        balance.units.equals(
                            defaultInitialBalance.units.subtracting(
                                Asset.fromFloat(0.0001, defaultSystemTokenSymbol).units
                            )
                        )
                    ).toBeTrue()

                    await expect(
                        contracts.registry.actions.regtoken([alice, 'FOO', '1.0000 A']).send(alice)
                    ).rejects.toThrow(
                        'eosio_assert: insufficient contract balance to pay registration fee'
                    )
                })
                test('prevent duplicate token symbol registration', async () => {
                    await contracts.registry.actions
                        .setconfig([
                            {
                                contract: defaultSystemTokenContract,
                                symbol: defaultSystemTokenSymbol,
                            },
                            {
                                receiver: defaultFeesAccount,
                                regtoken: '20.0000 A',
                            },
                        ])
                        .send()
                    await contracts.token.actions
                        .transfer([alice, registryContract, '50.0000 A', ''])
                        .send(alice)

                    // Register the token
                    await contracts.registry.actions
                        .regtoken([alice, 'FOO', '20.0000 A'])
                        .send(alice)

                    // Ensure token registered correctly
                    const rows = await contracts.registry.tables.tokens().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].contract).toBeNull()
                    expect(rows[0].ticker).toBe('FOO')
                    expect(rows[0].creator).toBe(alice)

                    // Try registering a duplicate
                    const action = contracts.registry.actions
                        .regtoken([alice, 'FOO', '20.0000 A'])
                        .send(alice)
                    expect(action).rejects.toThrow('eosio_assert: token is already registered')
                })
            })
        })
    })

    describe('admin', () => {
        describe('action: enable', () => {
            describe('success', () => {
                test('set enabled state', async () => {
                    await contracts.registry.actions.reset().send()
                    await contracts.registry.actions
                        .setconfig([
                            {
                                contract: 'foo.token',
                                symbol: '4,FOO',
                            },
                            {
                                receiver: 'foo',
                                regtoken: '1.0000 FOO',
                            },
                        ])
                        .send()
                    await contracts.registry.actions.enable().send()
                    const rows = await contracts.registry.tables.config().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].enabled).toBeTrue()
                })
            })
            describe('error', () => {
                test('require contract auth', async () => {
                    const action = contracts.registry.actions.enable().send(alice)
                    expect(action).rejects.toThrow('missing required authority registry')
                })
                test('requires configuration to be set before enabling', async () => {
                    await contracts.registry.actions.reset().send()
                    const action = contracts.registry.actions.enable().send()
                    expect(action).rejects.toThrow('eosio_assert: systemtoken symbol must be set')
                })
            })
        })
        describe('action: disable', () => {
            describe('success', () => {
                test('set disabled state', async () => {
                    await contracts.registry.actions.disable().send()
                    const rows = await contracts.registry.tables.config().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].enabled).toBeFalse()
                })
            })
            describe('error', () => {
                test('require contract auth', async () => {
                    const action = contracts.registry.actions.disable().send(alice)
                    expect(action).rejects.toThrow('missing required authority registry')
                })
            })
        })
        describe('action: setconfig', () => {
            describe('success', () => {
                test('setting token + fees', async () => {
                    await contracts.registry.actions.reset().send()
                    await contracts.registry.actions
                        .setconfig([
                            {
                                contract: 'foo.token',
                                symbol: '4,FOO',
                            },
                            {
                                receiver: 'foo',
                                regtoken: '1.0000 FOO',
                            },
                        ])
                        .send()
                    const rows = await contracts.registry.tables.config().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].enabled).toBeFalse()
                    expect(rows[0].systemtoken.contract).toBe('foo.token')
                    expect(rows[0].systemtoken.symbol).toBe('4,FOO')
                    expect(rows[0].fees.receiver).toBe('foo')
                    expect(rows[0].fees.regtoken).toBe('1.0000 FOO')
                })
                test('modifying enabled state maintains config data', async () => {
                    // Initial set with full config but disabled
                    await contracts.registry.actions.reset().send()
                    await contracts.registry.actions
                        .setconfig([
                            {
                                contract: 'foo.token',
                                symbol: '4,FOO',
                            },
                            {
                                receiver: 'foo',
                                regtoken: '1.0000 A',
                            },
                        ])
                        .send()
                    const rows = await contracts.registry.tables.config().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].enabled).toBeFalse()
                    expect(rows[0].systemtoken.contract).toBe('foo.token')
                    expect(rows[0].systemtoken.symbol).toBe('4,FOO')
                    expect(rows[0].fees.receiver).toBe('foo')
                    expect(rows[0].fees.regtoken).toBe('1.0000 A')

                    // Modify enabled state only
                    await contracts.registry.actions.enable().send()

                    // Verify config data is preserved
                    const updatedRows = await contracts.registry.tables.config().getTableRows()
                    expect(updatedRows).toHaveLength(1)
                    expect(updatedRows[0].enabled).toBeTrue()
                    expect(updatedRows[0].systemtoken.contract).toBe('foo.token')
                    expect(updatedRows[0].systemtoken.symbol).toBe('4,FOO')
                    expect(updatedRows[0].fees.receiver).toBe('foo')
                    expect(updatedRows[0].fees.regtoken).toBe('1.0000 A')
                })
            })
            describe('error', () => {
                test('require contract auth', async () => {
                    await contracts.registry.actions.reset().send()
                    const action = contracts.registry.actions
                        .setconfig([
                            {
                                contract: 'foo.token',
                                symbol: '4,FOO',
                            },
                            {
                                receiver: 'eosio.null',
                                regtoken: '1.0000 A',
                            },
                        ])
                        .send(alice)
                    expect(action).rejects.toThrow('missing required authority registry')
                })
            })
        })
        describe('action: addcontract', () => {
            describe('success', () => {
                test('add token contracts', async () => {
                    await contracts.registry.actions.reset().send()
                    await contracts.registry.actions.addcontract(['foo.token']).send()
                    await contracts.registry.actions.addcontract(['bar.token']).send()
                    const rows = await contracts.registry.tables.contracts().getTableRows()
                    expect(rows).toHaveLength(2)
                    const accounts = rows.map((r) => r.account)
                    expect(accounts).toContain('foo.token')
                    expect(accounts).toContain('bar.token')
                })
            })
            describe('error', () => {
                test('require contract auth', async () => {
                    const action = contracts.registry.actions.addcontract(['foo.token']).send(alice)
                    expect(action).rejects.toThrow('missing required authority registry')
                })
                test('prevent duplicate contract', async () => {
                    const action = contracts.registry.actions.addcontract([tokensContract]).send()
                    expect(action).rejects.toThrow('eosio_assert: contract is already registered')
                })
            })
        })
        describe('action: addtoken', () => {
            describe('success', () => {
                test('add token', async () => {
                    await contracts.registry.actions.addtoken([alice, 'EOS']).send()
                    const rows = await contracts.registry.tables.tokens().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].contract).toBeNull()
                    expect(rows[0].ticker).toBe('EOS')
                    expect(rows[0].creator).toBe(alice)
                })
                test('add multiple tokens', async () => {
                    await contracts.registry.actions.addtoken([alice, 'EOS']).send()
                    await contracts.registry.actions.addtoken([alice, 'FOO']).send()
                    const rows = await contracts.registry.tables.tokens().getTableRows()
                    expect(rows).toHaveLength(2)

                    const token1 = rows.find((r) => r.ticker === 'EOS')
                    expect(token1).toBeDefined()

                    const token2 = rows.find((r) => r.ticker === 'FOO')
                    expect(token2).toBeDefined()
                })
            })
            describe('error', () => {
                test('require contract auth', async () => {
                    const action = contracts.registry.actions.addtoken([alice, 'EOS']).send(alice)
                    expect(action).rejects.toThrow('missing required authority registry')
                })
                test('prevent duplicate contract/symbol', async () => {
                    await contracts.registry.actions.addtoken([alice, 'EOS']).send()
                    const action = contracts.registry.actions.addtoken([alice, 'EOS']).send()
                    expect(action).rejects.toThrow('eosio_assert: token is already registered')
                })
            })
        })
        describe('action: setcontract', () => {
            describe('success', () => {
                test('set token contract', async () => {
                    await contracts.token.actions
                        .transfer([alice, registryContract, '50.0000 A', ''])
                        .send(alice)
                    await contracts.registry.actions
                        .regtoken([alice, 'FOO', '1.0000 A'])
                        .send(alice)
                    await contracts.registry.actions
                        .setcontract(['FOO', tokensContract])
                        .send(alice)
                    const rows = await contracts.registry.tables.tokens().getTableRows()
                    expect(rows).toHaveLength(1)
                    const token = rows[0]
                    expect(token.contract).toBe(tokensContract)
                    expect(token.ticker).toBe('FOO')
                    expect(token.creator).toBe(alice)
                })
            })
            describe('error', () => {
                test('requires auth of creator', async () => {
                    await contracts.token.actions
                        .transfer([alice, registryContract, '50.0000 A', ''])
                        .send(alice)
                    await contracts.registry.actions
                        .regtoken([alice, 'FOO', '1.0000 A'])
                        .send(alice)
                    const action = contracts.registry.actions
                        .setcontract(['FOO', tokensContract])
                        .send(bob)
                    expect(action).rejects.toThrow('missing required authority alice')
                })
                test('cannot call on non-existing token', async () => {
                    const action = contracts.registry.actions
                        .setcontract(['FOO', tokensContract])
                        .send(alice)
                    expect(action).rejects.toThrow('eosio_assert: token is not registered')
                })
                test('cannot call twice on the same token', async () => {
                    await contracts.token.actions
                        .transfer([alice, registryContract, '50.0000 A', ''])
                        .send(alice)
                    await contracts.registry.actions
                        .regtoken([alice, 'FOO', '1.0000 A'])
                        .send(alice)
                    await contracts.registry.actions
                        .setcontract(['FOO', tokensContract])
                        .send(alice)
                    const action = contracts.registry.actions
                        .setcontract(['FOO', tokensContract])
                        .send(alice)
                    expect(action).rejects.toThrow(
                        'eosio_assert: token contract has already been set'
                    )
                })
                test('cannot set contract if not whitelisted', async () => {
                    await contracts.token.actions
                        .transfer([alice, registryContract, '50.0000 A', ''])
                        .send(alice)
                    await contracts.registry.actions
                        .regtoken([alice, 'FOO', '1.0000 A'])
                        .send(alice)
                    const action = contracts.registry.actions
                        .setcontract(['FOO', 'foo.token'])
                        .send(alice)
                    expect(action).rejects.toThrow('eosio_assert: contract is not whitelisted')
                })
            })
        })
        describe('action: rmcontract', () => {
            describe('success', () => {
                test('remove contract', async () => {
                    await contracts.registry.actions.addcontract(['eosio.token']).send()
                    const rows1 = await contracts.registry.tables.contracts().getTableRows()
                    expect(rows1).toHaveLength(2)

                    await contracts.registry.actions.rmcontract(['eosio.token']).send()
                    const rows2 = await contracts.registry.tables.contracts().getTableRows()
                    expect(rows2).toHaveLength(1)
                })
            })
            describe('error', () => {
                test('require contract auth', async () => {
                    const action = contracts.registry.actions
                        .rmcontract(['eosio.token'])
                        .send(alice)
                    expect(action).rejects.toThrow('missing required authority registry')
                })
                test('prevent removing non-existent contract', async () => {
                    const action = contracts.registry.actions.rmcontract(['eosio.token']).send()
                    expect(action).rejects.toThrow('eosio_assert: contract not found')
                })
            })
        })
        describe('action: rmtoken', () => {
            describe('success', () => {
                test('remove token', async () => {
                    await contracts.registry.actions
                        .addtoken([registryContract, 'EOS'])
                        .send(registryContract)
                    const rowsBefore = await contracts.registry.tables.tokens().getTableRows()
                    expect(rowsBefore).toHaveLength(1)

                    await contracts.registry.actions.rmtoken(['EOS']).send(registryContract)

                    const rowsAfter = await contracts.registry.tables.tokens().getTableRows()
                    expect(rowsAfter).toHaveLength(0)
                })
            })
            describe('error', () => {
                test('require contract auth', async () => {
                    const action = contracts.registry.actions.rmtoken(['EOS']).send(alice)
                    expect(action).rejects.toThrow('missing required authority registry')
                })
            })
        })
    })
})
