import {beforeEach, describe, expect, test} from 'bun:test'
import {Asset, Name} from '@wharfkit/antelope'

import {
    contracts,
    defaultFeesAccount,
    defaultInitialBalance,
    defaultSystemTokenContract,
    defaultSystemTokenSymbol,
    getTokenBalance,
    registryContract,
    resetContracts,
    setRegistryConfig,
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
                    await setRegistryConfig()

                    const balance = getTokenBalance('alice')
                    expect(balance.equals(defaultInitialBalance)).toBeTrue()

                    // Initial deposit
                    await contracts.token.actions
                        .transfer(['alice', registryContract, '5.0000 A', ''])
                        .send('alice')
                    let rows = await contracts.registry.tables.balance().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].account).toBe('alice')
                    expect(rows[0].balance).toBe('5.0000 A')

                    // Ensure balance deducted correctly
                    const balanceAfterDeposit1 = getTokenBalance('alice')
                    const expectedBalanceAfterDeposit1 = defaultInitialBalance.units.subtracting(
                        Asset.fromFloat(5, defaultSystemTokenSymbol).units
                    )
                    expect(
                        balanceAfterDeposit1.units.equals(expectedBalanceAfterDeposit1)
                    ).toBeTrue()

                    // Additional deposit
                    await contracts.token.actions
                        .transfer(['alice', registryContract, '3.0000 A', ''])
                        .send('alice')
                    rows = await contracts.registry.tables.balance().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].account).toBe('alice')
                    expect(rows[0].balance).toBe('8.0000 A')

                    // Ensure balance deducted correctly
                    const balanceAfterDeposit2 = getTokenBalance('alice')
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
                    const action = contracts.token.actions
                        .transfer(['alice', registryContract, '5.0000 A', ''])
                        .send('alice')
                    expect(action).rejects.toThrow('eosio_assert: contract is disabled')
                })
                test('reject incorrect token contract', async () => {
                    await setRegistryConfig()
                    const action = contracts.faketoken.actions
                        .transfer(['alice', registryContract, '5.0000 A', ''])
                        .send('alice')
                    expect(action).rejects.toThrow(
                        'eosio_assert: Incorrect token contract for deposit.'
                    )
                })
                test('reject incorrect token symbol', async () => {
                    await setRegistryConfig()
                    const action = contracts.token.actions
                        .transfer(['alice', registryContract, '5.0000 B', ''])
                        .send('alice')
                    expect(action).rejects.toThrow(
                        'eosio_assert: Incorrect token symbol for deposit.'
                    )
                })
            })
        })
        describe('action: withdraw', () => {
            describe('success', () => {
                test('withdraw funds', async () => {
                    await setRegistryConfig()
                    const balance = getTokenBalance('alice')
                    expect(balance.equals(defaultInitialBalance)).toBeTrue()

                    // Deposit funds first
                    await contracts.token.actions
                        .transfer(['alice', registryContract, '10.0000 A', ''])
                        .send('alice')

                    // Ensure contract balance updated correctly
                    const rowsAfterDeposit = await contracts.registry.tables
                        .balance()
                        .getTableRows()
                    expect(rowsAfterDeposit).toHaveLength(1)
                    expect(rowsAfterDeposit[0].account).toBe('alice')
                    expect(rowsAfterDeposit[0].balance).toBe('10.0000 A')

                    // Ensure account balance deducted correctly
                    const balanceAfterDeposit1 = getTokenBalance('alice')
                    const expectedBalanceAfterDeposit1 = defaultInitialBalance.units.subtracting(
                        Asset.fromFloat(10, defaultSystemTokenSymbol).units
                    )
                    expect(
                        balanceAfterDeposit1.units.equals(expectedBalanceAfterDeposit1)
                    ).toBeTrue()

                    // Withdraw funds from contract
                    await contracts.registry.actions.withdraw(['alice', '4.0000 A']).send('alice')

                    // Ensure contract balance updated correctly
                    const rowsAfterWithdraw = await contracts.registry.tables
                        .balance()
                        .getTableRows()
                    expect(rowsAfterWithdraw).toHaveLength(1)
                    expect(rowsAfterWithdraw[0].account).toBe('alice')
                    expect(rowsAfterWithdraw[0].balance).toBe('6.0000 A')

                    // Verify token balance updated correctly
                    const balanceAfterWithdraw = getTokenBalance('alice')
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
                    const action = contracts.registry.actions
                        .withdraw(['alice', '1.0000 FOO'])
                        .send('alice')

                    expect(action).rejects.toThrow('eosio_assert: contract is disabled')
                })
                test('no contract balance', async () => {
                    await setRegistryConfig()
                    const action = contracts.registry.actions
                        .withdraw(['alice', '100.0000 A'])
                        .send('alice')
                    expect(action).rejects.toThrow('eosio_assert: no contract balance for account')
                })
                test('insufficient contract balance', async () => {
                    await setRegistryConfig()
                    await contracts.token.actions
                        .transfer(['alice', registryContract, '10.0000 A', ''])
                        .send('alice')
                    const action = contracts.registry.actions
                        .withdraw(['alice', '100.0000 A'])
                        .send('alice')
                    expect(action).rejects.toThrow('eosio_assert: insufficient contract balance')
                })
                test('incorrect token symbol', async () => {
                    await setRegistryConfig()
                    await contracts.token.actions
                        .transfer(['alice', registryContract, '10.0000 A', ''])
                        .send('alice')
                    const action = contracts.registry.actions
                        .withdraw(['alice', '5.0000 B'])
                        .send('alice')
                    expect(action).rejects.toThrow(
                        'eosio_assert: Incorrect token symbol for withdraw'
                    )
                })
            })
        })
        describe('action: regtoken', () => {
            describe('success', () => {
                test('register token', async () => {
                    const balance = getTokenBalance('alice')
                    expect(balance.equals(defaultInitialBalance)).toBeTrue()

                    await contracts.registry.actions.addcontract([tokensContract]).send()
                    await contracts.registry.actions
                        .setconfig([
                            true,
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
                        .transfer(['alice', registryContract, '50.0000 A', ''])
                        .send('alice')

                    //
                    const balanceAfter = getTokenBalance('alice')
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
                        .regtoken([
                            tokensContract,
                            'alice',
                            '1.0000 FOO',
                            [
                                {receiver: 'alice', quantity: '0.5000 FOO'},
                                {receiver: 'bob', quantity: '0.5000 FOO'},
                            ],
                            '20.0000 A',
                        ])
                        .send('alice')

                    // Ensure token registered correctly
                    const rows = await contracts.registry.tables.tokens().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].contract).toBe('tokens')
                    expect(rows[0].symbol).toBe('4,FOO')

                    // Ensure contract balance deducted correctly
                    const contractBalance = await contracts.registry.tables.balance().getTableRows()
                    expect(contractBalance).toHaveLength(1)
                    expect(contractBalance[0].account).toBe('alice')
                    expect(contractBalance[0].balance).toBe('30.0000 A')

                    // Ensure the fee was transferred to the fee account
                    const feeBalanceAfter = getTokenBalance(defaultFeesAccount)
                    expect(
                        feeBalanceAfter.units.equals(
                            Asset.fromFloat(20, defaultSystemTokenSymbol).units
                        )
                    ).toBeTrue()

                    // Ensure the token was created with correct supply
                    const statsTable = await contracts.tokens.tables
                        .stat(Asset.SymbolCode.from('FOO').value.value)
                        .getTableRows()
                    expect(statsTable).toHaveLength(1)
                    expect(statsTable[0].supply).toBe('1.0000 FOO')
                    expect(statsTable[0].max_supply).toBe('1.0000 FOO')
                    expect(statsTable[0].issuer).toBe(registryContract)

                    // Ensure the token was allocated correctly
                    const aliceAccountsTable = await contracts.tokens.tables
                        .accounts(Name.from('alice').value.value)
                        .getTableRows()
                    expect(aliceAccountsTable).toHaveLength(1)
                    expect(aliceAccountsTable[0].balance).toBe('0.5000 FOO')
                    const bobAccountsTable = await contracts.tokens.tables
                        .accounts(Name.from('bob').value.value)
                        .getTableRows()
                    expect(bobAccountsTable).toHaveLength(1)
                    expect(bobAccountsTable[0].balance).toBe('0.5000 FOO')
                })
            })
            describe('error', () => {
                test('contract disabled', async () => {
                    await contracts.registry.actions.reset().send()
                    // Attempt to register token
                    const action = contracts.registry.actions
                        .regtoken(['eosio.token', 'alice', '1.0000 FOO', [], '1.0000 A'])
                        .send('alice')

                    expect(action).rejects.toThrow('eosio_assert: contract is disabled')
                })
                test('incorrect payment symbol', async () => {
                    await contracts.registry.actions.addcontract(['eosio.token']).send()
                    const action = contracts.registry.actions
                        .regtoken(['eosio.token', 'alice', '1.0000 FOO', [], '1.0000 B'])
                        .send('alice')

                    expect(action).rejects.toThrow('eosio_assert: incorrect payment symbol')
                })
                test('incorrect payment amount', async () => {
                    await contracts.registry.actions.addcontract(['eosio.token']).send()
                    const action = contracts.registry.actions
                        .regtoken(['eosio.token', 'alice', '1.0000 FOO', [], '2.0000 A'])
                        .send('alice')

                    expect(action).rejects.toThrow('eosio_assert: incorrect payment amount')
                })
                test('not on whitelist', async () => {
                    const action = contracts.registry.actions
                        .regtoken(['eosio.token', 'alice', '1.0000 FOO', [], '1.0000 A'])
                        .send('alice')

                    expect(action).rejects.toThrow('eosio_assert: contract is not whitelisted')
                })
                test('incorrect payment amount', async () => {
                    await contracts.registry.actions.addcontract(['eosio.token']).send()
                    await contracts.registry.actions
                        .setconfig([
                            true,
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
                        .transfer(['alice', registryContract, '50.0000 A', ''])
                        .send('alice')

                    const balance = getTokenBalance('alice')
                    expect(
                        balance.units.equals(
                            defaultInitialBalance.units.subtracting(
                                Asset.fromFloat(50, defaultSystemTokenSymbol).units
                            )
                        )
                    ).toBeTrue()

                    const rows = await contracts.registry.tables.balance().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].account).toBe('alice')
                    expect(rows[0].balance).toBe('50.0000 A')

                    const action = contracts.registry.actions
                        .regtoken(['eosio.token', 'alice', '1000.0000 FOO', [], '30.0000 A'])
                        .send('alice')

                    expect(action).rejects.toThrow('eosio_assert: incorrect payment amount')
                })
                test('insufficient contract balance to pay fee', async () => {
                    await contracts.registry.actions.addcontract(['tokens']).send()
                    await contracts.registry.actions
                        .setconfig([
                            true,
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
                        .transfer(['alice', registryContract, '10.0000 A', ''])
                        .send('alice')

                    const balance = getTokenBalance('alice')
                    expect(
                        balance.units.equals(
                            defaultInitialBalance.units.subtracting(
                                Asset.fromFloat(10, defaultSystemTokenSymbol).units
                            )
                        )
                    ).toBeTrue()

                    const action = contracts.registry.actions
                        .regtoken(['tokens', 'alice', '1.0000 FOO', [], '20.0000 A'])
                        .send('alice')

                    expect(action).rejects.toThrow(
                        'eosio_assert: insufficient contract balance to pay registration fee'
                    )
                })
            })
        })
    })

    describe('admin', () => {
        describe('action: setconfig', () => {
            describe('success', () => {
                test('set enabled state', async () => {
                    await contracts.registry.actions.reset().send()
                    await contracts.registry.actions
                        .setconfig([
                            true,
                            {
                                contract: 'foo.token',
                                symbol: '4,FOO',
                            },
                        ])
                        .send()
                    const rows = await contracts.registry.tables.config().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].enabled).toBeTrue()
                })
                test('set disabled state', async () => {
                    await contracts.registry.actions.reset().send()
                    await contracts.registry.actions
                        .setconfig([
                            false,
                            {
                                contract: 'foo.token',
                                symbol: '4,FOO',
                            },
                        ])
                        .send()
                    const rows = await contracts.registry.tables.config().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].enabled).toBeFalse()
                })
                test('setting fees', async () => {
                    await contracts.registry.actions.reset().send()
                    await contracts.registry.actions
                        .setconfig([
                            false,
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
                })
                test('modifying enabled state maintains config data', async () => {
                    // Initial set with full config but disabled
                    await contracts.registry.actions.reset().send()
                    await contracts.registry.actions
                        .setconfig([
                            false,
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
                    await contracts.registry.actions
                        .setconfig([
                            true,
                            {
                                contract: 'foo.token',
                                symbol: '4,FOO',
                            },
                        ])
                        .send()

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
                            false,
                            {
                                contract: 'foo.token',
                                symbol: '4,FOO',
                            },
                        ])
                        .send('alice')
                    expect(action).rejects.toThrow('missing required authority registry')
                })
            })
        })
        describe('action: addcontract', () => {
            describe('success', () => {
                test('add token contracts', async () => {
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
                    const action = contracts.registry.actions
                        .addcontract(['foo.token'])
                        .send('alice')
                    expect(action).rejects.toThrow('missing required authority registry')
                })
                test('prevent duplicate contract', async () => {
                    await contracts.registry.actions.addcontract(['foo.token']).send()
                    const action = contracts.registry.actions.addcontract(['foo.token']).send()
                    expect(action).rejects.toThrow('eosio_assert: contract is already registered')
                })
            })
        })
        describe('action: addtoken', () => {
            describe('success', () => {
                test('add token', async () => {
                    await contracts.registry.actions.addtoken(['eosio.token', '4,EOS']).send()
                    const rows = await contracts.registry.tables.tokens().getTableRows()
                    expect(rows).toHaveLength(1)
                    expect(rows[0].id).toBeInteger()
                    expect(rows[0].contract).toBe('eosio.token')
                    expect(rows[0].symbol).toBe('4,EOS')
                })
                test('add multiple tokens', async () => {
                    await contracts.registry.actions.addtoken(['eosio.token', '4,EOS']).send()
                    await contracts.registry.actions.addtoken(['foo.token', '4,FOO']).send()
                    const rows = await contracts.registry.tables.tokens().getTableRows()
                    expect(rows).toHaveLength(2)

                    const token1 = rows.find(
                        (r) => r.contract === 'eosio.token' && r.symbol === '4,EOS'
                    )
                    expect(token1).toBeDefined()
                    expect(token1!.id).toBeInteger()

                    const token2 = rows.find(
                        (r) => r.contract === 'foo.token' && r.symbol === '4,FOO'
                    )
                    expect(token2).toBeDefined()
                    expect(token2!.id).toBeInteger()
                })
            })
            describe('error', () => {
                test('require contract auth', async () => {
                    const action = contracts.registry.actions
                        .addtoken(['eosio.token', '4,EOS'])
                        .send('alice')
                    expect(action).rejects.toThrow('missing required authority registry')
                })
                test('prevent duplicate contract/symbol', async () => {
                    await contracts.registry.actions.addtoken(['eosio.token', '4,EOS']).send()
                    const action = contracts.registry.actions
                        .addtoken(['eosio.token', '4,EOS'])
                        .send()
                    expect(action).rejects.toThrow('eosio_assert: token is already registered')
                })
            })
        })
        describe('action: rmcontract', () => {
            describe('success', () => {
                test('remove contract', async () => {
                    await contracts.registry.actions.addcontract(['eosio.token']).send()
                    const rows1 = await contracts.registry.tables.contracts().getTableRows()
                    expect(rows1).toHaveLength(1)

                    await contracts.registry.actions.addcontract(['core.vaulta']).send()
                    const rows2 = await contracts.registry.tables.contracts().getTableRows()
                    expect(rows2).toHaveLength(2)

                    await contracts.registry.actions.rmcontract(['eosio.token']).send()
                    const rows3 = await contracts.registry.tables.contracts().getTableRows()
                    expect(rows3).toHaveLength(1)
                })
            })
            describe('error', () => {
                test('require contract auth', async () => {
                    const action = contracts.registry.actions
                        .rmcontract(['eosio.token'])
                        .send('alice')
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
                    await contracts.registry.actions.addtoken(['eosio.token', '4,EOS']).send()
                    const rowsBefore = await contracts.registry.tables.tokens().getTableRows()
                    expect(rowsBefore).toHaveLength(1)
                    const tokenId = rowsBefore[0].id

                    await contracts.registry.actions.rmtoken([tokenId]).send()

                    const rowsAfter = await contracts.registry.tables.tokens().getTableRows()
                    expect(rowsAfter).toHaveLength(0)
                })
            })
            describe('error', () => {
                test('require contract auth', async () => {
                    const action = contracts.registry.actions.rmtoken([1]).send('alice')
                    expect(action).rejects.toThrow('missing required authority registry')
                })
            })
        })
    })
})
