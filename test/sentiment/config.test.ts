import {beforeEach, describe, expect, test} from 'bun:test'

import {contracts, createTopic, defaultSetconfigArgs, resetContracts, sentimentContract} from './setup'

describe('contract: sentiment - Configuration', () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('action: enable', () => {
        test('contract owner can enable the contract', async () => {
            await contracts.sentiment.actions.disable().send(sentimentContract)

            await contracts.sentiment.actions.enable().send(sentimentContract)

            await createTopic('alice', 'testtopic', 'Test topic')

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
            await createTopic('alice', 'testtopic', 'Test topic')

            await contracts.sentiment.actions.disable().send(sentimentContract)

            await expect(
                contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')
            ).rejects.toThrow('eosio_assert: contract is disabled')
        })

        test('changevote fails when contract is disabled', async () => {
            await createTopic('alice', 'testtopic', 'Test topic')

            await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')

            await contracts.sentiment.actions.disable().send(sentimentContract)

            await expect(
                contracts.sentiment.actions.changevote(['alice', 'testtopic', 0]).send('alice')
            ).rejects.toThrow('eosio_assert: contract is disabled')
        })

        test('rmtopicvote fails when contract is disabled', async () => {
            await createTopic('alice', 'testtopic', 'Test topic')

            await contracts.sentiment.actions.votetopic(['alice', 'testtopic', 1]).send('alice')

            await contracts.sentiment.actions.disable().send(sentimentContract)

            await expect(
                contracts.sentiment.actions.rmtopicvote(['alice', 'testtopic']).send('alice')
            ).rejects.toThrow('eosio_assert: contract is disabled')
        })
    })

    describe('action: setconfig', () => {
        test('contract owner can set config', async () => {
            await contracts.sentiment.actions
                .setconfig(defaultSetconfigArgs)
                .send(sentimentContract)
        })

        test('non-owner cannot set config', async () => {
            await expect(
                contracts.sentiment.actions
                    .setconfig(defaultSetconfigArgs)
                    .send('alice')
            ).rejects.toThrow('missing required authority')
        })
    })

    describe('read-only actions', () => {
        test('read-only actions work when contract is disabled', async () => {
            await createTopic('alice', 'testtopic', 'Test topic')

            await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')

            await contracts.sentiment.actions.disable().send(sentimentContract)

            const topics = await contracts.sentiment.actions.gettopics().read()
            expect(topics).toHaveLength(1)

            const voters = await contracts.sentiment.actions.gettopicvtrs(['testtopic']).read()
            expect(voters).toHaveLength(1)
        })
    })
})
