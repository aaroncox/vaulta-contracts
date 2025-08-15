import {beforeEach, describe, expect, test} from 'bun:test'

import {contracts, registryContract, resetContracts, tokensContract} from '../helpers'

describe(`contract: ${tokensContract}`, () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('action: setconfig', () => {
        describe('success', () => {
            test('set registry contract', async () => {
                await contracts.tokens.actions.setconfig(['foo']).send()
                const rows = await contracts.tokens.tables.config().getTableRows()
                expect(rows).toHaveLength(1)
                expect(rows[0].registry).toBe('foo')
            })
        })
        describe('error', () => {
            test('require contract auth', async () => {
                const action = contracts.tokens.actions.setconfig([registryContract]).send('alice')
                expect(action).rejects.toThrow(`missing required authority ${tokensContract}`)
            })
        })
    })
})
