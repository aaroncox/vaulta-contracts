import {beforeEach, describe, expect, test} from 'bun:test'

import {
    alice,
    authSend,
    bob,
    deposit,
    getBalance,
    getBalanceAmount,
    getCredentialId,
    getCredentials,
    resetContracts,
    testKey1,
    testKey2,
} from './setup'

describe('contract: lightacct - Send', () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('action: send', () => {
        describe('success', () => {
            test('send between existing light accounts updates balances', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                await deposit(bob, '100.0000 A', testKey2)
                const credId1 = getCredentialId(testKey1)
                const credId2 = getCredentialId(testKey2)

                const senderBefore = getBalanceAmount(credId1)!
                const recipientBefore = getBalanceAmount(credId2)!

                await authSend(credId1, testKey2, '25.0000 A')

                const senderAfter = getBalanceAmount(credId1)!
                const recipientAfter = getBalanceAmount(credId2)!

                expect(Number(senderBefore.value) - Number(senderAfter.value)).toBe(25)
                expect(Number(recipientAfter.value) - Number(recipientBefore.value)).toBe(25)
            })

            test('send to new key creates credential for recipient', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId1 = getCredentialId(testKey1)

                const credentialsBefore = getCredentials()
                expect(credentialsBefore).toHaveLength(1)

                await authSend(credId1, testKey2, '50.0000 A')

                const credentialsAfter = getCredentials()
                expect(credentialsAfter).toHaveLength(2)
            })

            test('send to new key deducts RAM from recipient credit', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId1 = getCredentialId(testKey1)

                await authSend(credId1, testKey2, '50.0000 A')

                const credId2 = getCredentialId(testKey2)
                const recipientBalance = getBalanceAmount(credId2)!
                expect(Number(recipientBalance.value)).toBeLessThan(50)
                expect(Number(recipientBalance.value)).toBeGreaterThan(0)
            })

            test('send to existing key does not deduct RAM', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                await deposit(bob, '100.0000 A', testKey2)
                const credId1 = getCredentialId(testKey1)
                const credId2 = getCredentialId(testKey2)

                const recipientBefore = getBalanceAmount(credId2)!

                await authSend(credId1, testKey2, '25.0000 A')

                const recipientAfter = getBalanceAmount(credId2)!
                expect(Number(recipientAfter.value) - Number(recipientBefore.value)).toBe(25)
            })

            test('send with memo', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                await deposit(bob, '100.0000 A', testKey2)
                const credId1 = getCredentialId(testKey1)

                await authSend(credId1, testKey2, '10.0000 A', 'hello')
            })

            test('exactly 256-byte memo is accepted', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                await deposit(bob, '100.0000 A', testKey2)
                const credId1 = getCredentialId(testKey1)

                const memo = 'x'.repeat(256)
                await authSend(credId1, testKey2, '10.0000 A', memo)
            })

            test('send entire balance removes row', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                await deposit(bob, '100.0000 A', testKey2)
                const credId1 = getCredentialId(testKey1)

                const senderBalance = getBalance(credId1)
                const fullAmount = String(senderBalance[0].balance)

                await authSend(credId1, testKey2, fullAmount)

                const senderBalanceAfter = getBalance(credId1)
                expect(senderBalanceAfter).toHaveLength(0)
            })
        })

        describe('error', () => {
            test('rejects send with invalid quantity', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                await deposit(bob, '100.0000 A', testKey2)
                const credId1 = getCredentialId(testKey1)

                await expect(authSend(credId1, testKey2, '-10.0000 A')).rejects.toThrow()
            })

            test('rejects overdrawn balance', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                await deposit(bob, '100.0000 A', testKey2)
                const credId1 = getCredentialId(testKey1)

                await expect(authSend(credId1, testKey2, '99999.0000 A')).rejects.toThrow(
                    'eosio_assert: overdrawn balance'
                )
            })

            test('rejects memo over 256 bytes', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                await deposit(bob, '100.0000 A', testKey2)
                const credId1 = getCredentialId(testKey1)

                const longMemo = 'x'.repeat(257)
                await expect(authSend(credId1, testKey2, '10.0000 A', longMemo)).rejects.toThrow(
                    'eosio_assert: memo has more than 256 bytes'
                )
            })

            test('rejects send from credential with no balance', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                await deposit(bob, '100.0000 A', testKey2)
                const credId1 = getCredentialId(testKey1)

                const balances = getBalance(credId1)
                const fullAmount = String(balances[0].balance)
                await authSend(credId1, testKey2, fullAmount)

                expect(getBalance(credId1)).toHaveLength(0)

                await expect(authSend(credId1, testKey2, '1.0000 A')).rejects.toThrow(
                    'eosio_assert: no balance for this token'
                )
            })

            test('rejects send insufficient to cover new account RAM', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId1 = getCredentialId(testKey1)

                await expect(authSend(credId1, testKey2, '0.0001 A')).rejects.toThrow(
                    'eosio_assert: transfer insufficient to cover network fees (RAM)'
                )
            })
        })
    })
})
