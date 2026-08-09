import {beforeEach, describe, expect, test} from 'bun:test'

import {alice, contracts, getCreator, resetContracts} from './setup'

describe('contract: gift - creator admin', () => {
    beforeEach(async () => {
        await resetContracts()
    })

    test('addcreator registers a creator with a clean quota window', async () => {
        await contracts.gift.actions.addcreator([alice, 1000000]).send()
        const row = getCreator(alice)
        expect(row).toBeDefined()
        expect(Number(row.daily_quota_bytes)).toBe(1000000)
        expect(Number(row.used_bytes)).toBe(0)
    })

    test('addcreator rejects a nonexistent account', async () => {
        await expect(contracts.gift.actions.addcreator(['missing', 1000000]).send()).rejects.toThrow(
            'creator account does not exist'
        )
    })

    test('addcreator rejects a duplicate creator', async () => {
        await contracts.gift.actions.addcreator([alice, 1000000]).send()
        await expect(contracts.gift.actions.addcreator([alice, 2000000]).send()).rejects.toThrow(
            'creator already registered'
        )
    })

    test('addcreator rejects a non-positive quota', async () => {
        await expect(contracts.gift.actions.addcreator([alice, 0]).send()).rejects.toThrow(
            'quota must be positive'
        )
    })

    test('addcreator requires the contract authority', async () => {
        await expect(contracts.gift.actions.addcreator([alice, 1000000]).send(alice)).rejects.toThrow(
            'missing required authority'
        )
    })

    test('setquota updates the quota', async () => {
        await contracts.gift.actions.addcreator([alice, 1000000]).send()
        await contracts.gift.actions.setquota([alice, 5000000]).send()
        expect(Number(getCreator(alice).daily_quota_bytes)).toBe(5000000)
    })

    test('setquota rejects an unknown creator', async () => {
        await expect(contracts.gift.actions.setquota([alice, 5000000]).send()).rejects.toThrow(
            'creator not registered'
        )
    })

    test('rmcreator removes the creator', async () => {
        await contracts.gift.actions.addcreator([alice, 1000000]).send()
        await contracts.gift.actions.rmcreator([alice]).send()
        expect(getCreator(alice)).toBeUndefined()
    })

    test('rmcreator rejects an unknown creator', async () => {
        await expect(contracts.gift.actions.rmcreator([alice]).send()).rejects.toThrow(
            'creator not registered'
        )
    })
})
