import {beforeEach, describe, expect, test} from 'bun:test'

import {registryContract, contracts, resetContracts} from '../helpers'
import {Asset, Name} from '@wharfkit/antelope'

describe(`contract: ${registryContract}`, () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('action: setconfig', () => {
        describe('success', () => {
            test('set enabled state', async () => {
                await contracts.registry.actions.setconfig([true]).send()
                const rows = await contracts.registry.tables.config().getTableRows()
                expect(rows).toHaveLength(1)
                expect(rows[0].enabled).toBeTrue()
            })
            test('set disabled state', async () => {
                await contracts.registry.actions.setconfig([false]).send()
                const rows = await contracts.registry.tables.config().getTableRows()
                expect(rows).toHaveLength(1)
                expect(rows[0].enabled).toBeFalse()
            })
            test('setting fees', async () => {
                await contracts.registry.actions
                    .setconfig([
                        false,
                        {
                            token: {
                                contract: 'foo.token',
                                symbol: '4,FOO',
                            },
                            receiver: 'foo',
                            regtoken: '1.0000 A',
                        },
                    ])
                    .send()
                const rows = await contracts.registry.tables.config().getTableRows()
                expect(rows).toHaveLength(1)
                expect(rows[0].enabled).toBeFalse()
                expect(rows[0].fees.token.contract).toBe('foo.token')
                expect(rows[0].fees.token.symbol).toBe('4,FOO')
                expect(rows[0].fees.receiver).toBe('foo')
                expect(rows[0].fees.regtoken).toBe('1.0000 A')
            })
            test('modifying enabled state maintains config data', async () => {
                // Initial set with full config but disabled
                await contracts.registry.actions
                    .setconfig([
                        false,
                        {
                            token: {
                                contract: 'foo.token',
                                symbol: '4,FOO',
                            },
                            receiver: 'foo',
                            regtoken: '1.0000 A',
                        },
                    ])
                    .send()
                const rows = await contracts.registry.tables.config().getTableRows()
                expect(rows).toHaveLength(1)
                expect(rows[0].enabled).toBeFalse()
                expect(rows[0].fees.token.contract).toBe('foo.token')
                expect(rows[0].fees.token.symbol).toBe('4,FOO')
                expect(rows[0].fees.receiver).toBe('foo')
                expect(rows[0].fees.regtoken).toBe('1.0000 A')

                // Modify enabled state only
                await contracts.registry.actions.setconfig([true]).send()

                // Verify config data is preserved
                const updatedRows = await contracts.registry.tables.config().getTableRows()
                expect(updatedRows).toHaveLength(1)
                expect(updatedRows[0].enabled).toBeTrue()
                expect(updatedRows[0].fees.token.contract).toBe('foo.token')
                expect(updatedRows[0].fees.token.symbol).toBe('4,FOO')
                expect(updatedRows[0].fees.receiver).toBe('foo')
                expect(updatedRows[0].fees.regtoken).toBe('1.0000 A')
            })
        })
        describe('error', () => {
            test('require contract auth', async () => {
                const action = contracts.registry.actions.setconfig([false]).send('alice')
                expect(action).rejects.toThrow('missing required authority registry')
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

                const token2 = rows.find((r) => r.contract === 'foo.token' && r.symbol === '4,FOO')
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
                const action = contracts.registry.actions.addtoken(['eosio.token', '4,EOS']).send()
                expect(action).rejects.toThrow('eosio_assert: token is already registered')
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
                const action = contracts.registry.actions.addcontract(['foo.token']).send('alice')
                expect(action).rejects.toThrow('missing required authority registry')
            })
            test('prevent duplicate contract', async () => {
                await contracts.registry.actions.addcontract(['foo.token']).send()
                const action = contracts.registry.actions.addcontract(['foo.token']).send()
                expect(action).rejects.toThrow('eosio_assert: contract is already registered')
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

    describe('action: regtoken', () => {
        describe('success', () => {
            test('register token', async () => {
                await contracts.registry.actions.setconfig([true]).send()
                await contracts.registry.actions.addcontract(['eosio.token']).send()
                await contracts.registry.actions
                    .regtoken(['eosio.token', 'alice', '1.0000 FOO', [], '1.0000 A'])
                    .send('alice')
                const rows = await contracts.registry.tables.tokens().getTableRows()
                expect(rows).toHaveLength(1)
                expect(rows[0].contract).toBe('eosio.token')
                expect(rows[0].symbol).toBe('4,FOO')
            })
        })
        describe('error', () => {
            test('incorrect payment symbol', async () => {
                await contracts.registry.actions
                    .setconfig([
                        true,
                        {
                            token: {
                                contract: 'eosio.token',
                                symbol: '4,A',
                            },
                            receiver: 'registry',
                            regtoken: '1.0000 A',
                        },
                    ])
                    .send()
                await contracts.registry.actions.addcontract(['eosio.token']).send()
                const action = contracts.registry.actions
                    .regtoken(['eosio.token', 'alice', '1.0000 FOO', [], '1.0000 B'])
                    .send('alice')

                expect(action).rejects.toThrow('eosio_assert: incorrect payment symbol')
            })
            test('incorrect payment amount', async () => {
                await contracts.registry.actions
                    .setconfig([
                        true,
                        {
                            token: {
                                contract: 'eosio.token',
                                symbol: '4,A',
                            },
                            receiver: 'registry',
                            regtoken: '1.0000 A',
                        },
                    ])
                    .send()
                await contracts.registry.actions.addcontract(['eosio.token']).send()
                const action = contracts.registry.actions
                    .regtoken(['eosio.token', 'alice', '1.0000 FOO', [], '2.0000 A'])
                    .send('alice')

                expect(action).rejects.toThrow('eosio_assert: incorrect payment amount')
            })
            test('not on whitelist', async () => {
                await contracts.registry.actions.setconfig([true]).send()
                const action = contracts.registry.actions
                    .regtoken(['eosio.token', 'alice', '1.0000 FOO', [], '1.0000 A'])
                    .send('alice')

                expect(action).rejects.toThrow('eosio_assert: contract is not whitelisted')
            })
            test('registry disabled', async () => {
                // Attempt to register token
                const action = contracts.registry.actions
                    .regtoken(['eosio.token', 'alice', '1.0000 FOO', [], '1.0000 A'])
                    .send('alice')

                expect(action).rejects.toThrow('eosio_assert: contract is disabled')
            })
        })
    })
})
