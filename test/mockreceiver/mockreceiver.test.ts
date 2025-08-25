import {beforeEach, describe, expect, test} from 'bun:test'

import {
    alice,
    bob,
    contracts,
    getTokenBalance,
    mockreceiverContract,
    resetContracts,
    systemtokenContract,
    tokensContract,
} from '../helpers'
import {Name} from '@wharfkit/antelope'

describe(`contract: ${mockreceiverContract}`, () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('action: setconfig', () => {
        describe('success', () => {
            test('set config', async () => {
                await contracts.mockreceiver.actions
                    .setconfig([systemtokenContract, alice, bob])
                    .send()
                const rows = await contracts.mockreceiver.tables.config().getTableRows()
                expect(rows).toHaveLength(1)
                expect(Name.from(rows[0].tokencontract).equals(systemtokenContract)).toBeTrue()
                expect(Name.from(rows[0].sender).equals(alice)).toBeTrue()
                expect(Name.from(rows[0].destination).equals(bob)).toBeTrue()
            })
        })
        describe('error', () => {
            test('require contract auth', async () => {
                expect(
                    contracts.mockreceiver.actions
                        .setconfig([systemtokenContract, alice, bob])
                        .send(alice)
                ).rejects.toThrow('missing required authority mockreceiver')
            })
        })
    })

    describe('action: on_transfer', () => {
        describe('success', () => {
            test('forward tokens', async () => {
                await contracts.tokens.actions.create([alice, '1000.0000 FOO']).send()
                await contracts.tokens.actions.issue([alice, '1000.0000 FOO', 'memo']).send(alice)
                await contracts.mockreceiver.actions.setconfig([tokensContract, alice, bob]).send()
                await contracts.tokens.actions.open([bob, '4,FOO', alice]).send(alice)
                await contracts.tokens.actions
                    .transfer([alice, mockreceiverContract, '100.0000 FOO', ''])
                    .send(alice)
                const aliceBalance = getTokenBalance(alice, 'tokens', '4,FOO')
                expect(String(aliceBalance)).toEqual('900.0000 FOO')
                const mockreceiverBalance = getTokenBalance(mockreceiverContract, 'tokens', '4,FOO')
                expect(String(mockreceiverBalance)).toEqual('0.0000 FOO')
                const bobBalance = getTokenBalance(bob, 'tokens', '4,FOO')
                expect(String(bobBalance)).toEqual('100.0000 FOO')
            })
        })
        describe('error', () => {
            test('sender not allowed', async () => {
                await contracts.mockreceiver.actions
                    .setconfig([systemtokenContract, alice, bob])
                    .send()
                const action = contracts.token.actions
                    .transfer([bob, mockreceiverContract, '100.0000 A', ''])
                    .send(bob)
                expect(action).rejects.toThrow(
                    'eosio_assert: Tokens must be sent from the configured sender account.'
                )
            })
            test('must send positive amount', async () => {
                await contracts.mockreceiver.actions
                    .setconfig([systemtokenContract, alice, bob])
                    .send()
                const action = contracts.token.actions
                    .transfer([alice, mockreceiverContract, '0.0000 A', ''])
                    .send(alice)
                expect(action).rejects.toThrow('eosio_assert: must transfer positive quantity')
            })
            test('wrong contract', async () => {
                await contracts.mockreceiver.actions
                    .setconfig([systemtokenContract, alice, bob])
                    .send()
                const action = contracts.faketoken.actions
                    .transfer([alice, mockreceiverContract, '100.0000 A', ''])
                    .send(alice)
                expect(action).rejects.toThrow(
                    'eosio_assert: Only the configured token contract may send tokens to the mockreceiver.'
                )
            })
        })
    })
})
