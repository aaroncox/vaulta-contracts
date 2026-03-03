import {beforeEach, describe, expect, test} from 'bun:test'

import {
    alice,
    authSend,
    authWithdraw,
    bob,
    contracts,
    deposit,
    getCredentialId,
    keyhostAccount,
    lightacctContract,
    permissionFromId,
    resetContracts,
    sendTransaction,
    testKey1,
    testKey2,
} from './setup'

describe('contract: lightacct - Auth', () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('action: authkey', () => {
        describe('success', () => {
            test('authenticates single credential', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                const permName = permissionFromId(credId)
                await sendTransaction([
                    {
                        account: lightacctContract,
                        name: 'authkey',
                        data: {credential_ids: [credId]},
                        authorization: `${keyhostAccount}@${permName}`,
                    },
                ])
            })

            test('authenticates multiple credential_ids in single call', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                await deposit(bob, '100.0000 A', testKey2)
                const credId1 = getCredentialId(testKey1)
                const credId2 = getCredentialId(testKey2)

                await sendTransaction([
                    {
                        account: lightacctContract,
                        name: 'authkey',
                        data: {credential_ids: [credId1, credId2]},
                        authorization: [
                            `${keyhostAccount}@${permissionFromId(credId1)}`,
                            `${keyhostAccount}@${permissionFromId(credId2)}`,
                        ],
                    },
                ])
            })
        })

        describe('error', () => {
            test('rejects empty credential_ids', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                const permName = permissionFromId(credId)
                await expect(
                    sendTransaction([
                        {
                            account: lightacctContract,
                            name: 'authkey',
                            data: {credential_ids: []},
                            authorization: `${keyhostAccount}@${permName}`,
                        },
                    ])
                ).rejects.toThrow('eosio_assert: must provide at least one credential id')
            })

            test('rejects nonexistent credential_id', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                const permName = permissionFromId(credId)
                await expect(
                    sendTransaction([
                        {
                            account: lightacctContract,
                            name: 'authkey',
                            data: {credential_ids: [999]},
                            authorization: `${keyhostAccount}@${permName}`,
                        },
                    ])
                ).rejects.toThrow('eosio_assert: credential not found')
            })

            test('rejects authkey on uninitialized contract', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)
                await contracts.lightacct.actions.reset().send()

                const permName = permissionFromId(credId)
                await expect(
                    sendTransaction([
                        {
                            account: lightacctContract,
                            name: 'authkey',
                            data: {credential_ids: [credId]},
                            authorization: `${keyhostAccount}@${permName}`,
                        },
                    ])
                ).rejects.toThrow('eosio_assert: contract not initialized')
            })
        })
    })

    describe('validate_auth', () => {
        describe('success', () => {
            test('send works with multi-credential authkey', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                await deposit(bob, '100.0000 A', testKey2)
                const credId1 = getCredentialId(testKey1)
                const credId2 = getCredentialId(testKey2)

                await authSend(credId1, testKey2, '10.0000 A', '', [credId1, credId2])
            })

            test('withdraw works with multi-credential authkey', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                await deposit(bob, '100.0000 A', testKey2)
                const credId1 = getCredentialId(testKey1)
                const credId2 = getCredentialId(testKey2)

                await authWithdraw(credId1, alice, '10.0000 A', '', [credId1, credId2])
            })
        })

        describe('error', () => {
            test('send rejects mismatched credential in authkey', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                await deposit(bob, '100.0000 A', testKey2)
                const credId1 = getCredentialId(testKey1)
                const credId2 = getCredentialId(testKey2)

                await expect(
                    sendTransaction([
                        {
                            account: lightacctContract,
                            name: 'authkey',
                            data: {credential_ids: [credId2]},
                            authorization: `${keyhostAccount}@${permissionFromId(credId2)}`,
                        },
                        {
                            account: lightacctContract,
                            name: 'send',
                            data: {
                                from_id: credId1,
                                to_key: testKey2,
                                quantity: '10.0000 A',
                                memo: '',
                            },
                            authorization: `${keyhostAccount}@${permissionFromId(credId1)}`,
                        },
                    ])
                ).rejects.toThrow('eosio_assert: credential not authenticated in authkey')
            })

            test('withdraw rejects mismatched credential in authkey', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                await deposit(bob, '100.0000 A', testKey2)
                const credId1 = getCredentialId(testKey1)
                const credId2 = getCredentialId(testKey2)

                await expect(
                    sendTransaction([
                        {
                            account: lightacctContract,
                            name: 'authkey',
                            data: {credential_ids: [credId2]},
                            authorization: `${keyhostAccount}@${permissionFromId(credId2)}`,
                        },
                        {
                            account: lightacctContract,
                            name: 'withdraw',
                            data: {
                                credential_id: credId1,
                                to_account: alice,
                                quantity: '10.0000 A',
                                memo: '',
                            },
                            authorization: `${keyhostAccount}@${permissionFromId(credId1)}`,
                        },
                    ])
                ).rejects.toThrow('eosio_assert: credential not authenticated in authkey')
            })

            test('send without authkey as first action fails', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                const permName = permissionFromId(credId)
                await expect(
                    sendTransaction([
                        {
                            account: lightacctContract,
                            name: 'send',
                            data: {
                                from_id: credId,
                                to_key: testKey2,
                                quantity: '10.0000 A',
                                memo: '',
                            },
                            authorization: `${keyhostAccount}@${permName}`,
                        },
                    ])
                ).rejects.toThrow('eosio_assert: first action must be authkey')
            })

            test('withdraw without authkey as first action fails', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)

                const permName = permissionFromId(credId)
                await expect(
                    sendTransaction([
                        {
                            account: lightacctContract,
                            name: 'withdraw',
                            data: {
                                credential_id: credId,
                                to_account: alice,
                                quantity: '10.0000 A',
                                memo: '',
                            },
                            authorization: `${keyhostAccount}@${permName}`,
                        },
                    ])
                ).rejects.toThrow('eosio_assert: first action must be authkey')
            })

            test('send on uninitialized contract fails', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)
                await contracts.lightacct.actions.reset().send()

                const permName = permissionFromId(credId)
                await expect(
                    sendTransaction([
                        {
                            account: lightacctContract,
                            name: 'authkey',
                            data: {credential_ids: [credId]},
                            authorization: `${keyhostAccount}@${permName}`,
                        },
                        {
                            account: lightacctContract,
                            name: 'send',
                            data: {
                                from_id: credId,
                                to_key: testKey1,
                                quantity: '10.0000 A',
                                memo: '',
                            },
                            authorization: `${keyhostAccount}@${permName}`,
                        },
                    ])
                ).rejects.toThrow('eosio_assert: contract not initialized')
            })

            test('withdraw on uninitialized contract fails', async () => {
                await deposit(alice, '100.0000 A', testKey1)
                const credId = getCredentialId(testKey1)
                await contracts.lightacct.actions.reset().send()

                const permName = permissionFromId(credId)
                await expect(
                    sendTransaction([
                        {
                            account: lightacctContract,
                            name: 'authkey',
                            data: {credential_ids: [credId]},
                            authorization: `${keyhostAccount}@${permName}`,
                        },
                        {
                            account: lightacctContract,
                            name: 'withdraw',
                            data: {
                                credential_id: credId,
                                to_account: alice,
                                quantity: '10.0000 A',
                                memo: '',
                            },
                            authorization: `${keyhostAccount}@${permName}`,
                        },
                    ])
                ).rejects.toThrow('eosio_assert: contract not initialized')
            })
        })
    })
})
