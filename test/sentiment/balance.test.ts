import {beforeEach, describe, expect, test} from 'bun:test'
import {Asset, Name} from '@wharfkit/antelope'

import {
    alice,
    bob,
    charlie,
    contracts,
    defaultInitialBalance,
    defaultTokenSymbol,
    depositTokens,
    feeReceiver,
    sentimentContract,
    resetContracts,
    topicFee,
} from './setup'

function getTokenBalance(account: string, contract: string = 'token'): Asset {
    const scope = Name.from(account).value.value
    const primary_key = Asset.Symbol.from(defaultTokenSymbol).code.value.value
    const row = contracts[contract].tables.accounts(scope).getTableRow(primary_key)
    if (!row) throw new Error('Balance not found')
    return Asset.from(row.balance)
}

describe('contract: sentiment - Balance Management', () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('notify: on_transfer (deposit)', () => {
        describe('success', () => {
            test('deposit funds', async () => {
                await depositTokens(alice, '5.0000 A')

                const rows = await contracts.sentiment.tables.balance().getTableRows()
                expect(rows).toHaveLength(1)
                expect(rows[0].account).toBe('alice')
                expect(rows[0].balance).toBe('5.0000 A')
            })

            test('additional deposit adds to existing balance', async () => {
                await depositTokens(alice, '5.0000 A')
                await depositTokens(alice, '3.0000 A')

                const rows = await contracts.sentiment.tables.balance().getTableRows()
                expect(rows).toHaveLength(1)
                expect(rows[0].balance).toBe('8.0000 A')
            })

            test('multiple accounts can deposit', async () => {
                await depositTokens(alice, '5.0000 A')
                await depositTokens(bob, '10.0000 A')

                const rows = await contracts.sentiment.tables.balance().getTableRows()
                expect(rows).toHaveLength(2)
            })

            test('token balance deducted from sender', async () => {
                const before = getTokenBalance(alice)
                await depositTokens(alice, '5.0000 A')
                const after = getTokenBalance(alice)

                const expected = before.units.subtracting(Asset.fromFloat(5, defaultTokenSymbol).units)
                expect(after.units.equals(expected)).toBeTrue()
            })
        })

        describe('error', () => {
            test('ignore deposit from fake token contract', async () => {
                await contracts.faketoken.actions
                    .transfer([alice, sentimentContract, '5.0000 A', ''])
                    .send(alice)

                const rows = await contracts.sentiment.tables.balance().getTableRows()
                expect(rows).toHaveLength(0)
            })

            test('reject deposit with wrong symbol', async () => {
                const tokenName = 'core.vaulta'
                const supply = Asset.fromFloat(1000000000, '4,B')
                await contracts.token.actions.create([tokenName, String(supply)]).send()
                await contracts.token.actions.issue([tokenName, String(supply), '']).send()
                await contracts.token.actions
                    .transfer([tokenName, alice, '100.0000 B', ''])
                    .send()

                await expect(
                    contracts.token.actions
                        .transfer([alice, sentimentContract, '5.0000 B', ''])
                        .send(alice)
                ).rejects.toThrow('eosio_assert: incorrect token symbol for deposit')
            })

            test('reject deposit when contract is disabled', async () => {
                await contracts.sentiment.actions.disable().send(sentimentContract)

                await expect(
                    contracts.token.actions
                        .transfer([alice, sentimentContract, '5.0000 A', ''])
                        .send(alice)
                ).rejects.toThrow('eosio_assert: contract is disabled')
            })
        })
    })

    describe('action: withdraw', () => {
        describe('success', () => {
            test('withdraw full balance', async () => {
                await depositTokens(alice, '10.0000 A')

                await contracts.sentiment.actions.withdraw([alice, '10.0000 A']).send(alice)

                const rows = await contracts.sentiment.tables.balance().getTableRows()
                expect(rows).toHaveLength(0)
            })

            test('withdraw partial balance', async () => {
                await depositTokens(alice, '10.0000 A')

                await contracts.sentiment.actions.withdraw([alice, '4.0000 A']).send(alice)

                const rows = await contracts.sentiment.tables.balance().getTableRows()
                expect(rows).toHaveLength(1)
                expect(rows[0].balance).toBe('6.0000 A')
            })

            test('tokens returned to account', async () => {
                await depositTokens(alice, '10.0000 A')
                const balanceAfterDeposit = getTokenBalance(alice)

                await contracts.sentiment.actions.withdraw([alice, '4.0000 A']).send(alice)

                const balanceAfterWithdraw = getTokenBalance(alice)
                const expected = balanceAfterDeposit.units.adding(
                    Asset.fromFloat(4, defaultTokenSymbol).units
                )
                expect(balanceAfterWithdraw.units.equals(expected)).toBeTrue()
            })
        })

        describe('error', () => {
            test('cannot withdraw without balance', async () => {
                await expect(
                    contracts.sentiment.actions.withdraw([alice, '1.0000 A']).send(alice)
                ).rejects.toThrow('eosio_assert: no contract balance for account')
            })

            test('cannot withdraw more than balance', async () => {
                await depositTokens(alice, '5.0000 A')

                await expect(
                    contracts.sentiment.actions.withdraw([alice, '5.0001 A']).send(alice)
                ).rejects.toThrow('eosio_assert: insufficient contract balance')
            })

            test('cannot withdraw wrong symbol', async () => {
                await depositTokens(alice, '5.0000 A')

                await expect(
                    contracts.sentiment.actions.withdraw([alice, '1.0000 FOO']).send(alice)
                ).rejects.toThrow('eosio_assert: incorrect token symbol for withdraw')
            })

            test('cannot withdraw when contract is disabled', async () => {
                await depositTokens(alice, '5.0000 A')
                await contracts.sentiment.actions.disable().send(sentimentContract)

                await expect(
                    contracts.sentiment.actions.withdraw([alice, '5.0000 A']).send(alice)
                ).rejects.toThrow('eosio_assert: contract is disabled')
            })

            test('cannot withdraw another account funds', async () => {
                await depositTokens(alice, '10.0000 A')

                await expect(
                    contracts.sentiment.actions.withdraw([alice, '5.0000 A']).send(bob)
                ).rejects.toThrow()
            })
        })
    })

    describe('security', () => {
        test('fake token contract cannot inflate balances', async () => {
            await contracts.faketoken.actions
                .transfer([alice, sentimentContract, '1000.0000 A', ''])
                .send(alice)

            const rows = await contracts.sentiment.tables.balance().getTableRows()
            expect(rows).toHaveLength(0)
        })

        test('deposit + createtopic deducts balance correctly', async () => {
            await depositTokens(alice, '5.0000 A')

            let rows = await contracts.sentiment.tables.balance().getTableRows()
            expect(rows[0].balance).toBe('5.0000 A')

            await contracts.sentiment.actions
                .createtopic([alice, 'testtopic', 'Test', String(topicFee)])
                .send(alice)

            rows = await contracts.sentiment.tables.balance().getTableRows()
            expect(rows[0].balance).toBe('4.0000 A')
        })

        test('fee is forwarded to receiver on topic creation', async () => {
            await depositTokens(alice, String(topicFee))

            await contracts.sentiment.actions
                .createtopic([alice, 'testtopic', 'Test', String(topicFee)])
                .send(alice)

            const receiverBalance = getTokenBalance(feeReceiver)
            expect(receiverBalance.units.equals(topicFee.units)).toBeTrue()
        })

        test('cannot create topic without depositing first', async () => {
            await expect(
                contracts.sentiment.actions
                    .createtopic([alice, 'testtopic', 'Test', String(topicFee)])
                    .send(alice)
            ).rejects.toThrow('eosio_assert: insufficient contract balance to pay topic creation fee')
        })

        test('cannot spend another users deposit via createtopic', async () => {
            await depositTokens(alice, '10.0000 A')

            await expect(
                contracts.sentiment.actions
                    .createtopic([bob, 'testtopic', 'Test', String(topicFee)])
                    .send(bob)
            ).rejects.toThrow('eosio_assert: insufficient contract balance to pay topic creation fee')
        })

        test('balance isolation between accounts', async () => {
            await depositTokens(alice, '10.0000 A')
            await depositTokens(bob, '5.0000 A')

            await contracts.sentiment.actions.withdraw([alice, '10.0000 A']).send(alice)

            const rows = await contracts.sentiment.tables.balance().getTableRows()
            expect(rows).toHaveLength(1)
            expect(rows[0].account).toBe('bob')
            expect(rows[0].balance).toBe('5.0000 A')
        })

        test('deposit then withdraw full amount returns tokens', async () => {
            const before = getTokenBalance(alice)

            await depositTokens(alice, '50.0000 A')
            await contracts.sentiment.actions.withdraw([alice, '50.0000 A']).send(alice)

            const after = getTokenBalance(alice)
            expect(after.units.equals(before.units)).toBeTrue()
        })
    })
})
