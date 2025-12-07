import {beforeEach, describe, expect, test} from 'bun:test'

import {alice, contracts, resetContracts, sentimentContract} from './setup'

describe('contract: sentiment - Configuration', () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('action: enable', () => {
        test('contract owner can enable the contract', async () => {
            // First disable it
            await contracts.sentiment.actions.disable().send(sentimentContract)

            // Then enable it
            await contracts.sentiment.actions.enable().send(sentimentContract)

            // Verify users can vote when enabled
            await contracts.sentiment.actions
                .createtopic(['testtopic', 'Test topic'])
                .send(sentimentContract)

            await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')
        })

        test('non-owner cannot enable the contract', async () => {
            await contracts.sentiment.actions.disable().send(sentimentContract)

            await expect(contracts.sentiment.actions.enable().send('alice')).rejects.toThrow(
                'missing required authority'
            )
        })
    })

    describe('action: disable', () => {
        test('contract owner can disable the contract', async () => {
            await contracts.sentiment.actions.disable().send(sentimentContract)

            // Create a topic (contract-authorized action should still work)
            await contracts.sentiment.actions
                .createtopic(['testtopic', 'Test topic'])
                .send(sentimentContract)

            // User actions should fail
            await expect(
                contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')
            ).rejects.toThrow('eosio_assert: contract is disabled')
        })

        test('non-owner cannot disable the contract', async () => {
            await expect(contracts.sentiment.actions.disable().send('alice')).rejects.toThrow(
                'missing required authority'
            )
        })

        test('voting fails when contract is disabled', async () => {
            await contracts.sentiment.actions
                .createtopic(['testtopic', 'Test topic'])
                .send(sentimentContract)

            await contracts.sentiment.actions.disable().send(sentimentContract)

            await expect(
                contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')
            ).rejects.toThrow('eosio_assert: contract is disabled')
        })

        test('changevote fails when contract is disabled', async () => {
            await contracts.sentiment.actions
                .createtopic(['testtopic', 'Test topic'])
                .send(sentimentContract)

            // Vote while enabled
            await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')

            // Disable
            await contracts.sentiment.actions.disable().send(sentimentContract)

            // Try to change vote
            await expect(
                contracts.sentiment.actions.changevote(['alice', 'testtopic', 0]).send('alice')
            ).rejects.toThrow('eosio_assert: contract is disabled')
        })

        test('rmtopicvote fails when contract is disabled', async () => {
            await contracts.sentiment.actions
                .createtopic(['testtopic', 'Test topic'])
                .send(sentimentContract)

            // Vote while enabled
            await contracts.sentiment.actions.votetopic(['alice', 'testtopic', 1]).send('alice')

            // Disable
            await contracts.sentiment.actions.disable().send(sentimentContract)

            // Try to remove vote
            await expect(
                contracts.sentiment.actions.rmtopicvote(['alice', 'testtopic']).send('alice')
            ).rejects.toThrow('eosio_assert: contract is disabled')
        })
    })

    describe('action: setconfig', () => {
        test('contract owner can set config', async () => {
            await contracts.sentiment.actions
                .setconfig([{enabled: false, system_contract: 'eosio'}])
                .send(sentimentContract)

            // Create a topic (contract-authorized action should still work)
            await contracts.sentiment.actions
                .createtopic(['testtopic', 'Test topic'])
                .send(sentimentContract)

            // User actions should fail
            await expect(
                contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')
            ).rejects.toThrow('eosio_assert: contract is disabled')
        })

        test('non-owner cannot set config', async () => {
            await expect(
                contracts.sentiment.actions
                    .setconfig([{enabled: false, system_contract: 'eosio'}])
                    .send('alice')
            ).rejects.toThrow('missing required authority')
        })
    })

    describe('read-only actions', () => {
        test('read-only actions work when contract is disabled', async () => {
            await contracts.sentiment.actions
                .createtopic(['testtopic', 'Test topic'])
                .send(sentimentContract)

            // Vote while enabled
            await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')

            // Disable
            await contracts.sentiment.actions.disable().send(sentimentContract)

            // Read-only actions should still work
            const topics = await contracts.sentiment.actions.gettopics().read()
            expect(topics).toHaveLength(1)

            const voters = await contracts.sentiment.actions.gettopicvtrs(['testtopic']).read()
            expect(voters).toHaveLength(1)
        })
    })
})
