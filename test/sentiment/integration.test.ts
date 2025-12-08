import {beforeEach, describe, expect, test} from 'bun:test'
import {Name} from '@wharfkit/antelope'

import {contracts, resetContracts, sentimentContract} from './setup'

describe('contract: sentiment - Integration Tests', () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('integration: voting lifecycle', () => {
        test('full voting lifecycle', async () => {
            // Create topic
            await contracts.sentiment.actions
                .createtopic(['debate', 'Should we implement feature X?'])
                .send(sentimentContract)

            // Multiple users vote
            await contracts.sentiment.actions.vote(['alice', 'debate', 1]).send('alice')
            await contracts.sentiment.actions.vote(['bob', 'debate', 1]).send('bob')
            await contracts.sentiment.actions.vote(['charlie', 'debate', 0]).send('charlie')

            let debateVotes = await contracts.sentiment.tables
                .votes(Name.from('debate').value.value)
                .getTableRows()
            expect(debateVotes).toHaveLength(3)
            let support = debateVotes.filter((v) => v.vote_type === 1)
            let opposition = debateVotes.filter((v) => v.vote_type === 0)
            expect(support).toHaveLength(2)
            expect(opposition).toHaveLength(1)

            // One user changes their mind
            await contracts.sentiment.actions.changevote(['bob', 'debate', 0]).send('bob')

            debateVotes = await contracts.sentiment.tables
                .votes(Name.from('debate').value.value)
                .getTableRows()
            support = debateVotes.filter((v) => v.vote_type === 1)
            opposition = debateVotes.filter((v) => v.vote_type === 0)
            expect(support).toHaveLength(1)
            expect(opposition).toHaveLength(2)

            // One user removes their vote
            await contracts.sentiment.actions.rmtopicvote(['charlie', 'debate']).send('charlie')

            debateVotes = await contracts.sentiment.tables
                .votes(Name.from('debate').value.value)
                .getTableRows()
            expect(debateVotes).toHaveLength(2)
            support = debateVotes.filter((v) => v.vote_type === 1)
            opposition = debateVotes.filter((v) => v.vote_type === 0)
            expect(support).toHaveLength(1)
            expect(opposition).toHaveLength(1)
        })

        test('deleting topic removes all votes', async () => {
            await contracts.sentiment.actions
                .createtopic(['testtopic', 'Test topic'])
                .send(sentimentContract)

            await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')
            await contracts.sentiment.actions.vote(['bob', 'testtopic', 0]).send('bob')

            let votes = await contracts.sentiment.tables
                .votes(Name.from('testtopic').value.value)
                .getTableRows()
            expect(votes).toHaveLength(2)

            await contracts.sentiment.actions.deletetopic(['testtopic']).send(sentimentContract)

            votes = await contracts.sentiment.tables
                .votes(Name.from('testtopic').value.value)
                .getTableRows()
            expect(votes).toHaveLength(0)
        })
    })
})
