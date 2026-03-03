import {beforeEach, describe, expect, test} from 'bun:test'

import {
    alice,
    authWithdraw,
    bob,
    deposit,
    getBalance,
    getBalanceAmount,
    getCredentialId,
    getTokenBalance,
    resetContracts,
    testKey1,
} from './setup'

describe('contract: lightacct - Withdraw', () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('action: withdraw', () => {
        describe('success', () => {
            test('withdraw sends tokens to external account', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                const aliceBefore = getTokenBalance(alice)

                await authWithdraw(credId, alice, '25.0000 A')

                const aliceAfter = getTokenBalance(alice)
                expect(Number(aliceAfter.value) - Number(aliceBefore.value)).toBe(25)
            })

            test('withdraw reduces light account balance', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                const amountBefore = getBalanceAmount(credId)!

                await authWithdraw(credId, alice, '25.0000 A')

                const amountAfter = getBalanceAmount(credId)!
                expect(Number(amountBefore.value) - Number(amountAfter.value)).toBe(25)
            })

            test('withdraw sends exact amount without RAM deduction', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                const aliceBefore = getTokenBalance(alice)

                await authWithdraw(credId, alice, '50.0000 A')

                const aliceAfter = getTokenBalance(alice)
                expect(Number(aliceAfter.value) - Number(aliceBefore.value)).toBe(50)
            })

            test('withdraw entire balance removes row', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                const balances = getBalance(credId)
                const fullAmount = String(balances[0].balance)

                await authWithdraw(credId, alice, fullAmount)

                expect(getBalance(credId)).toHaveLength(0)
            })

            test('withdraw to different account', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                const bobBefore = getTokenBalance(bob)

                await authWithdraw(credId, bob, '25.0000 A')

                const bobAfter = getTokenBalance(bob)
                expect(Number(bobAfter.value) - Number(bobBefore.value)).toBe(25)
            })

            test('withdraw with memo', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                await authWithdraw(credId, alice, '10.0000 A', 'withdrawal memo')
            })

            test('exactly 256-byte memo is accepted', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                const memo = 'x'.repeat(256)
                await authWithdraw(credId, alice, '10.0000 A', memo)
            })

            test('multiple partial withdrawals', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                const balanceBefore = getBalanceAmount(credId)!

                await authWithdraw(credId, alice, '10.0000 A')
                await authWithdraw(credId, alice, '15.0000 A')

                const balanceAfter = getBalanceAmount(credId)!
                expect(Number(balanceBefore.value) - Number(balanceAfter.value)).toBe(25)
            })
        })

        describe('error', () => {
            test('rejects overdrawn balance', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                await expect(authWithdraw(credId, alice, '99999.0000 A')).rejects.toThrow(
                    'eosio_assert: overdrawn balance'
                )
            })

            test('rejects negative quantity', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                await expect(authWithdraw(credId, alice, '-10.0000 A')).rejects.toThrow()
            })

            test('rejects withdraw to nonexistent account', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                await expect(authWithdraw(credId, 'nonexistent', '10.0000 A')).rejects.toThrow(
                    'eosio_assert: destination account does not exist'
                )
            })

            test('rejects memo over 256 bytes', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                const longMemo = 'x'.repeat(257)
                await expect(authWithdraw(credId, alice, '10.0000 A', longMemo)).rejects.toThrow(
                    'eosio_assert: memo has more than 256 bytes'
                )
            })

            test('rejects withdraw for nonexistent credential', async () => {
                await deposit(alice, '100.0000 A', testKey1)

                await expect(authWithdraw(999, alice, '10.0000 A')).rejects.toThrow()
            })

            test('rejects withdraw from credential with no balance', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                const balances = getBalance(credId)
                const fullAmount = String(balances[0].balance)
                await authWithdraw(credId, alice, fullAmount)

                expect(getBalance(credId)).toHaveLength(0)

                await expect(authWithdraw(credId, alice, '1.0000 A')).rejects.toThrow(
                    'eosio_assert: no balance for this token'
                )
            })
        })
    })
})
