import {beforeEach, describe, expect, test} from 'bun:test'

import {alice, contracts, getOperator, resetContracts} from './setup'

describe('contract: gift - operator admin', () => {
    beforeEach(async () => {
        await resetContracts()
    })

    test('addoper registers an operator with a clean quota window', async () => {
        await contracts.gift.actions.addoper([alice, 1000000]).send()
        const row = getOperator(alice)
        expect(row).toBeDefined()
        expect(Number(row.daily_quota_bytes)).toBe(1000000)
        expect(Number(row.used_bytes)).toBe(0)
    })

    test('addoper rejects a nonexistent account', async () => {
        await expect(contracts.gift.actions.addoper(['missing', 1000000]).send()).rejects.toThrow(
            'operator account does not exist'
        )
    })

    test('addoper rejects a duplicate operator', async () => {
        await contracts.gift.actions.addoper([alice, 1000000]).send()
        await expect(contracts.gift.actions.addoper([alice, 2000000]).send()).rejects.toThrow(
            'operator already registered'
        )
    })

    test('addoper rejects a non-positive quota', async () => {
        await expect(contracts.gift.actions.addoper([alice, 0]).send()).rejects.toThrow(
            'quota must be positive'
        )
    })

    test('addoper requires the contract authority', async () => {
        await expect(contracts.gift.actions.addoper([alice, 1000000]).send(alice)).rejects.toThrow(
            'missing required authority'
        )
    })

    test('setquota updates the quota', async () => {
        await contracts.gift.actions.addoper([alice, 1000000]).send()
        await contracts.gift.actions.setquota([alice, 5000000]).send()
        expect(Number(getOperator(alice).daily_quota_bytes)).toBe(5000000)
    })

    test('setquota rejects an unknown operator', async () => {
        await expect(contracts.gift.actions.setquota([alice, 5000000]).send()).rejects.toThrow(
            'operator not registered'
        )
    })

    test('rmoper removes the operator', async () => {
        await contracts.gift.actions.addoper([alice, 1000000]).send()
        await contracts.gift.actions.rmoper([alice]).send()
        expect(getOperator(alice)).toBeUndefined()
    })

    test('rmoper rejects an unknown operator', async () => {
        await expect(contracts.gift.actions.rmoper([alice]).send()).rejects.toThrow(
            'operator not registered'
        )
    })
})
