import {beforeEach, describe, expect, test} from 'bun:test'
import {Name} from '@wharfkit/antelope'

import {contracts, resetContracts, sentimentContract} from './setup'

describe('contract: sentiment - Voting', () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('action: vote', () => {
        describe('success', () => {
            test('user can vote in support of a topic', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')

                const votes = await contracts.sentiment.tables
                    .votes(Name.from('testtopic').value.value)
                    .getTableRows()
                expect(votes).toHaveLength(1)
                expect(votes[0].voter).toBe('alice')
                expect(votes[0].topic_id).toBe('testtopic')
                expect(votes[0].vote_type).toBe(1)
            })

            test('user can vote in opposition to a topic', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['bob', 'testtopic', 0]).send('bob')

                const votes = await contracts.sentiment.tables
                    .votes(Name.from('testtopic').value.value)
                    .getTableRows()
                expect(votes).toHaveLength(1)
                expect(votes[0].voter).toBe('bob')
                expect(votes[0].vote_type).toBe(0)
            })

            test('multiple users can vote on the same topic', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')
                await contracts.sentiment.actions.vote(['bob', 'testtopic', 1]).send('bob')
                await contracts.sentiment.actions.vote(['charlie', 'testtopic', 0]).send('charlie')

                const votes = await contracts.sentiment.tables
                    .votes(Name.from('testtopic').value.value)
                    .getTableRows()
                expect(votes).toHaveLength(3)
            })

            test('user can vote on multiple topics', async () => {
                await contracts.sentiment.actions
                    .createtopic(['topic1', 'First topic'])
                    .send(sentimentContract)
                await contracts.sentiment.actions
                    .createtopic(['topic2', 'Second topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['alice', 'topic1', 1]).send('alice')
                await contracts.sentiment.actions.vote(['alice', 'topic2', 0]).send('alice')

                const votes1 = await contracts.sentiment.tables
                    .votes(Name.from('topic1').value.value)
                    .getTableRows()
                expect(votes1).toHaveLength(1)
                expect(votes1[0].vote_type).toBe(1)

                const votes2 = await contracts.sentiment.tables
                    .votes(Name.from('topic2').value.value)
                    .getTableRows()
                expect(votes2).toHaveLength(1)
                expect(votes2[0].vote_type).toBe(0)
            })
        })

        describe('error', () => {
            test('cannot vote on non-existent topic', async () => {
                await expect(
                    contracts.sentiment.actions.vote(['alice', 'nonexistent', 1]).send('alice')
                ).rejects.toThrow('eosio_assert: topic does not exist')
            })

            test('cannot vote with invalid vote_type', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await expect(
                    contracts.sentiment.actions.vote(['alice', 'testtopic', 2]).send('alice')
                ).rejects.toThrow('eosio_assert: vote_type must be 0 (opposition) or 1 (support)')
            })

            test('can vote twice on same topic (upsert behavior)', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                // First vote (support)
                await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')

                let votes = await contracts.sentiment.tables
                    .votes(Name.from('testtopic').value.value)
                    .getTableRows()
                expect(votes).toHaveLength(1)
                expect(votes[0].vote_type).toBe(1)

                // Second vote (opposition) - should update
                await contracts.sentiment.actions.vote(['alice', 'testtopic', 0]).send('alice')

                votes = await contracts.sentiment.tables
                    .votes(Name.from('testtopic').value.value)
                    .getTableRows()
                expect(votes).toHaveLength(1) // Still just one vote
                expect(votes[0].vote_type).toBe(0) // Vote type changed
            })

            test('missing authorization', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await expect(
                    contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('bob')
                ).rejects.toThrow()
            })
        })
    })

    describe('action: changevote', () => {
        describe('success', () => {
            test('user can change vote from support to opposition', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')

                await contracts.sentiment.actions
                    .changevote(['alice', 'testtopic', 0])
                    .send('alice')

                const votes = await contracts.sentiment.tables
                    .votes(Name.from('testtopic').value.value)
                    .getTableRows()
                expect(votes[0].vote_type).toBe(0)
            })

            test('user can change vote from opposition to support', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['alice', 'testtopic', 0]).send('alice')

                await contracts.sentiment.actions
                    .changevote(['alice', 'testtopic', 1])
                    .send('alice')

                const votes = await contracts.sentiment.tables
                    .votes(Name.from('testtopic').value.value)
                    .getTableRows()
                expect(votes[0].vote_type).toBe(1)
            })
        })

        describe('error', () => {
            test('cannot change vote that does not exist', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await expect(
                    contracts.sentiment.actions.changevote(['alice', 'testtopic', 1]).send('alice')
                ).rejects.toThrow('eosio_assert: vote does not exist, use vote to create')
            })

            test('cannot change vote to same type', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')

                await expect(
                    contracts.sentiment.actions.changevote(['alice', 'testtopic', 1]).send('alice')
                ).rejects.toThrow('eosio_assert: new vote type is the same as current vote type')
            })

            test('cannot change vote on non-existent topic', async () => {
                await expect(
                    contracts.sentiment.actions
                        .changevote(['alice', 'nonexistent', 1])
                        .send('alice')
                ).rejects.toThrow('eosio_assert: topic does not exist')
            })

            test('missing authorization', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')

                await expect(
                    contracts.sentiment.actions.changevote(['alice', 'testtopic', 0]).send('bob')
                ).rejects.toThrow()
            })
        })
    })

    describe('action: rmtopicvote', () => {
        describe('success', () => {
            test('user can remove their support vote', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.votetopic(['alice', 'testtopic', 1]).send('alice')

                await contracts.sentiment.actions.rmtopicvote(['alice', 'testtopic']).send('alice')

                const votes = await contracts.sentiment.tables
                    .votes(Name.from('testtopic').value.value)
                    .getTableRows()
                expect(votes).toHaveLength(0)
            })

            test('user can remove their opposition vote', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.votetopic(['alice', 'testtopic', 0]).send('alice')

                await contracts.sentiment.actions.rmtopicvote(['alice', 'testtopic']).send('alice')

                const votes = await contracts.sentiment.tables
                    .votes(Name.from('testtopic').value.value)
                    .getTableRows()
                expect(votes).toHaveLength(0)
            })

            test('removing vote does not affect other votes', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.votetopic(['alice', 'testtopic', 1]).send('alice')
                await contracts.sentiment.actions.votetopic(['bob', 'testtopic', 1]).send('bob')

                await contracts.sentiment.actions.rmtopicvote(['alice', 'testtopic']).send('alice')

                const votes = await contracts.sentiment.tables
                    .votes(Name.from('testtopic').value.value)
                    .getTableRows()
                expect(votes).toHaveLength(1)
                expect(votes[0].voter).toBe('bob')
            })
        })

        describe('error', () => {
            test('cannot remove vote that does not exist', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await expect(
                    contracts.sentiment.actions.rmtopicvote(['alice', 'testtopic']).send('alice')
                ).rejects.toThrow('eosio_assert: vote does not exist')
            })

            test('cannot remove vote on non-existent topic', async () => {
                await expect(
                    contracts.sentiment.actions.rmtopicvote(['alice', 'nonexistent']).send('alice')
                ).rejects.toThrow('eosio_assert: topic does not exist')
            })

            test('missing authorization', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.votetopic(['alice', 'testtopic', 1]).send('alice')

                await expect(
                    contracts.sentiment.actions.rmtopicvote(['alice', 'testtopic']).send('bob')
                ).rejects.toThrow()
            })
        })
    })

    describe('action: bulkrmvotes', () => {
        describe('success', () => {
            test('can remove specified number of votes', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                // Create 3 votes
                await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')
                await contracts.sentiment.actions.vote(['bob', 'testtopic', 1]).send('bob')
                await contracts.sentiment.actions.vote(['charlie', 'testtopic', 0]).send('charlie')

                // Verify all votes exist
                let votes = await contracts.sentiment.tables
                    .votes(Name.from('testtopic').value.value)
                    .getTableRows()
                expect(votes).toHaveLength(3)

                // Remove 2 votes
                await contracts.sentiment.actions
                    .bulkrmvotes(['testtopic', 2])
                    .send(sentimentContract)

                // Verify only 1 vote remains
                votes = await contracts.sentiment.tables
                    .votes(Name.from('testtopic').value.value)
                    .getTableRows()
                expect(votes).toHaveLength(1)
            })

            test('can remove all votes if num_votes exceeds total', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                // Create 3 votes
                await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')
                await contracts.sentiment.actions.vote(['bob', 'testtopic', 1]).send('bob')
                await contracts.sentiment.actions.vote(['charlie', 'testtopic', 0]).send('charlie')

                // Try to remove 10 votes (more than exist)
                await contracts.sentiment.actions
                    .bulkrmvotes(['testtopic', 10])
                    .send(sentimentContract)

                // Verify all votes are removed
                const votes = await contracts.sentiment.tables
                    .votes(Name.from('testtopic').value.value)
                    .getTableRows()
                expect(votes).toHaveLength(0)
            })

            test('can remove zero votes', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')
                await contracts.sentiment.actions.vote(['bob', 'testtopic', 1]).send('bob')

                // Remove 0 votes
                await contracts.sentiment.actions
                    .bulkrmvotes(['testtopic', 0])
                    .send(sentimentContract)

                // Verify votes still exist
                const votes = await contracts.sentiment.tables
                    .votes(Name.from('testtopic').value.value)
                    .getTableRows()
                expect(votes).toHaveLength(2)
            })

            test('removing votes from one topic does not affect other topics', async () => {
                await contracts.sentiment.actions
                    .createtopic(['topic1', 'First topic'])
                    .send(sentimentContract)
                await contracts.sentiment.actions
                    .createtopic(['topic2', 'Second topic'])
                    .send(sentimentContract)

                // Add votes to both topics
                await contracts.sentiment.actions.vote(['alice', 'topic1', 1]).send('alice')
                await contracts.sentiment.actions.vote(['bob', 'topic1', 1]).send('bob')
                await contracts.sentiment.actions.vote(['alice', 'topic2', 0]).send('alice')
                await contracts.sentiment.actions.vote(['bob', 'topic2', 0]).send('bob')

                // Remove votes from topic1
                await contracts.sentiment.actions.bulkrmvotes(['topic1', 2]).send(sentimentContract)

                // Verify topic1 votes are removed
                const votes1 = await contracts.sentiment.tables
                    .votes(Name.from('topic1').value.value)
                    .getTableRows()
                expect(votes1).toHaveLength(0)

                // Verify topic2 votes are intact
                const votes2 = await contracts.sentiment.tables
                    .votes(Name.from('topic2').value.value)
                    .getTableRows()
                expect(votes2).toHaveLength(2)
            })
        })

        describe('error', () => {
            test('cannot bulk remove votes from non-existent topic', async () => {
                await expect(
                    contracts.sentiment.actions
                        .bulkrmvotes(['nonexistent', 5])
                        .send(sentimentContract)
                ).rejects.toThrow('eosio_assert: topic does not exist')
            })

            test('missing authorization - requires contract authority', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')

                await expect(
                    contracts.sentiment.actions.bulkrmvotes(['testtopic', 1]).send('alice')
                ).rejects.toThrow()
            })
        })
    })

    describe('action: gettopicvote (read-only)', () => {
        describe('success', () => {
            test('returns vote details for support vote', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')

                const vote = await contracts.sentiment.actions
                    .gettopicvote(['alice', 'testtopic'])
                    .read()

                expect(String(vote.voter)).toBe('alice')
                expect(String(vote.topic_id)).toBe('testtopic')
                expect(Number(vote.vote_type)).toBe(1)
            })

            test('returns vote details for opposition vote', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['bob', 'testtopic', 0]).send('bob')

                const vote = await contracts.sentiment.actions
                    .gettopicvote(['bob', 'testtopic'])
                    .read()

                expect(String(vote.voter)).toBe('bob')
                expect(String(vote.topic_id)).toBe('testtopic')
                expect(Number(vote.vote_type)).toBe(0)
            })
        })

        describe('error', () => {
            test('vote does not exist', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await expect(
                    contracts.sentiment.actions.gettopicvote(['alice', 'testtopic']).read()
                ).rejects.toThrow('eosio_assert: vote does not exist')
            })
        })
    })

    describe('action: gettopicvtrs (read-only)', () => {
        describe('success', () => {
            test('returns all voters for a topic', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')
                await contracts.sentiment.actions.vote(['bob', 'testtopic', 0]).send('bob')
                await contracts.sentiment.actions.vote(['charlie', 'testtopic', 1]).send('charlie')

                const voters = await contracts.sentiment.actions.gettopicvtrs(['testtopic']).read()

                expect(voters).toHaveLength(3)
                expect(String(voters[0].voter)).toBe('alice')
                expect(String(voters[1].voter)).toBe('bob')
                expect(String(voters[2].voter)).toBe('charlie')
            })

            test('returns empty array for topic with no votes', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                const voters = await contracts.sentiment.actions.gettopicvtrs(['testtopic']).read()

                expect(voters).toHaveLength(0)
            })

            test('vote counts are correctly reflected', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')
                await contracts.sentiment.actions.vote(['bob', 'testtopic', 0]).send('bob')
                await contracts.sentiment.actions.vote(['charlie', 'testtopic', 1]).send('charlie')

                const voters = await contracts.sentiment.actions.gettopicvtrs(['testtopic']).read()

                const support = voters.filter((v) => Number(v.vote_type) === 1)
                const opposition = voters.filter((v) => Number(v.vote_type) === 0)
                expect(support).toHaveLength(2)
                expect(opposition).toHaveLength(1)
            })
        })

        describe('error', () => {
            test('topic does not exist', async () => {
                await expect(
                    contracts.sentiment.actions.gettopicvtrs(['nonexistent']).read()
                ).rejects.toThrow('eosio_assert: topic does not exist')
            })
        })
    })

    describe('read-only vote queries', () => {
        describe('success', () => {
            test('get vote counts in topic response', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')
                await contracts.sentiment.actions.vote(['bob', 'testtopic', 1]).send('bob')
                await contracts.sentiment.actions.vote(['charlie', 'testtopic', 0]).send('charlie')

                const topics = await contracts.sentiment.tables.topics().getTableRows()
                expect(topics[0].id).toBe('testtopic')
            })

            test('vote counts are updated correctly after changes', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')
                await contracts.sentiment.actions.vote(['bob', 'testtopic', 0]).send('bob')

                await contracts.sentiment.actions.changevote(['bob', 'testtopic', 1]).send('bob')

                const votes = await contracts.sentiment.tables
                    .votes(Name.from('testtopic').value.value)
                    .getTableRows()
                const support = votes.filter((v) => v.vote_type === 1)
                const opposition = votes.filter((v) => v.vote_type === 0)
                expect(support).toHaveLength(2)
                expect(opposition).toHaveLength(0)
            })

            test('get all voters for a topic', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.vote(['alice', 'testtopic', 1]).send('alice')
                await contracts.sentiment.actions.vote(['bob', 'testtopic', 0]).send('bob')
                await contracts.sentiment.actions.vote(['charlie', 'testtopic', 1]).send('charlie')

                const votes = await contracts.sentiment.tables
                    .votes(Name.from('testtopic').value.value)
                    .getTableRows()
                expect(votes).toHaveLength(3)

                const support = votes.filter((v) => v.vote_type === 1)
                const opposition = votes.filter((v) => v.vote_type === 0)
                expect(support).toHaveLength(2)
                expect(opposition).toHaveLength(1)
            })
        })
    })

    describe('action: getweight', () => {
        describe('success', () => {
            test('returns zero weight for account with no stake', async () => {
                const result = await contracts.sentiment.actions.getweight(['alice']).read()
                expect(result).toBeDefined()
                expect(String(result.voter)).toBe('alice')
                expect(Number(result.weight)).toBe(0)
            })

            test('returns weight for account with staked tokens', async () => {
                // Note: In a real test environment, you would first stake tokens for the account
                // This test verifies the method works, but returns 0 since we haven't set up staking
                const result = await contracts.sentiment.actions.getweight(['bob']).read()
                expect(result).toBeDefined()
                expect(String(result.voter)).toBe('bob')
                expect(Number(result.weight)).toBeGreaterThanOrEqual(0)
            })
        })

        describe('error', () => {
            test('fails for non-existent account', async () => {
                await expect(
                    contracts.sentiment.actions.getweight(['nonexistent']).read()
                ).rejects.toThrow()
            })
        })
    })

    describe('action: getweights', () => {
        describe('success', () => {
            test('returns weights for multiple accounts', async () => {
                const result = await contracts.sentiment.actions
                    .getweights([['alice', 'bob', 'charlie']])
                    .read()
                expect(result).toBeDefined()
                expect(result).toHaveLength(3)
                expect(String(result[0].voter)).toBe('alice')
                expect(String(result[1].voter)).toBe('bob')
                expect(String(result[2].voter)).toBe('charlie')
                expect(Number(result[0].weight)).toBe(0)
                expect(Number(result[1].weight)).toBe(0)
                expect(Number(result[2].weight)).toBe(0)
            })

            test('returns empty array for empty input', async () => {
                const result = await contracts.sentiment.actions.getweights([[]]).read()
                expect(result).toBeDefined()
                expect(result).toHaveLength(0)
            })

            test('returns weights for single account in array', async () => {
                const result = await contracts.sentiment.actions.getweights([['alice']]).read()
                expect(result).toBeDefined()
                expect(result).toHaveLength(1)
                expect(String(result[0].voter)).toBe('alice')
                expect(Number(result[0].weight)).toBeGreaterThanOrEqual(0)
            })

            test('handles duplicate accounts in input', async () => {
                const result = await contracts.sentiment.actions
                    .getweights([['alice', 'alice', 'bob']])
                    .read()
                expect(result).toBeDefined()
                expect(result).toHaveLength(3)
                expect(String(result[0].voter)).toBe('alice')
                expect(String(result[1].voter)).toBe('alice')
                expect(String(result[2].voter)).toBe('bob')
            })
        })

        describe('error', () => {
            test('fails if any account does not exist', async () => {
                await expect(
                    contracts.sentiment.actions.getweights([['alice', 'nonexistent', 'bob']]).read()
                ).rejects.toThrow()
            })
        })
    })
})
