import {beforeEach, describe, expect, test} from 'bun:test'
import {Name} from '@wharfkit/antelope'

import {alice, bob, charlie, contracts, resetContracts, sentimentContract} from './setup'

describe('contract: sentiment - Account Voting', () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('action: voteaccount', () => {
        describe('success', () => {
            test('user can vote in support of an account', async () => {
                await contracts.sentiment.actions.voteaccount([alice, bob, 1]).send(alice)

                const votes = await contracts.sentiment.tables
                    .accountvotes(Name.from(bob).value.value)
                    .getTableRows()
                expect(votes).toHaveLength(1)
                expect(votes[0].voter).toBe('alice')
                expect(votes[0].account).toBe('bob')
                expect(votes[0].vote_type).toBe(1)
            })

            test('user can vote in opposition to an account', async () => {
                await contracts.sentiment.actions.voteaccount([alice, bob, 0]).send(alice)

                const votes = await contracts.sentiment.tables
                    .accountvotes(Name.from(bob).value.value)
                    .getTableRows()
                expect(votes).toHaveLength(1)
                expect(votes[0].voter).toBe('alice')
                expect(votes[0].vote_type).toBe(0)
            })

            test('multiple users can vote on the same account', async () => {
                await contracts.sentiment.actions.voteaccount([alice, charlie, 1]).send(alice)
                await contracts.sentiment.actions.voteaccount([bob, charlie, 1]).send(bob)
                await contracts.sentiment.actions.voteaccount([charlie, charlie, 0]).send(charlie)

                const votes = await contracts.sentiment.tables
                    .accountvotes(Name.from(charlie).value.value)
                    .getTableRows()
                expect(votes).toHaveLength(3)
            })

            test('user can vote on multiple accounts', async () => {
                await contracts.sentiment.actions.voteaccount([alice, bob, 1]).send(alice)
                await contracts.sentiment.actions.voteaccount([alice, charlie, 0]).send(alice)

                const bobVotes = await contracts.sentiment.tables
                    .accountvotes(Name.from(bob).value.value)
                    .getTableRows()
                expect(bobVotes).toHaveLength(1)
                expect(bobVotes[0].vote_type).toBe(1)

                const charlieVotes = await contracts.sentiment.tables
                    .accountvotes(Name.from(charlie).value.value)
                    .getTableRows()
                expect(charlieVotes).toHaveLength(1)
                expect(charlieVotes[0].vote_type).toBe(0)
            })

            test('user can update their vote (upsert behavior)', async () => {
                // First vote (support)
                await contracts.sentiment.actions.voteaccount([alice, bob, 1]).send(alice)

                let votes = await contracts.sentiment.tables
                    .accountvotes(Name.from(bob).value.value)
                    .getTableRows()
                expect(votes).toHaveLength(1)
                expect(votes[0].vote_type).toBe(1)

                // Second vote (opposition) - should update
                await contracts.sentiment.actions.voteaccount([alice, bob, 0]).send(alice)

                votes = await contracts.sentiment.tables
                    .accountvotes(Name.from(bob).value.value)
                    .getTableRows()
                expect(votes).toHaveLength(1) // Still just one vote
                expect(votes[0].vote_type).toBe(0) // Vote type changed
            })

            test('user can vote on themselves', async () => {
                await contracts.sentiment.actions.voteaccount([alice, alice, 1]).send(alice)

                const votes = await contracts.sentiment.tables
                    .accountvotes(Name.from(alice).value.value)
                    .getTableRows()
                expect(votes).toHaveLength(1)
                expect(votes[0].voter).toBe('alice')
                expect(votes[0].account).toBe('alice')
            })
        })

        describe('validation', () => {
            test('requires contract to be enabled', async () => {
                await contracts.sentiment.actions.disable().send(sentimentContract)

                await expect(
                    contracts.sentiment.actions.voteaccount(['alice', 'bob', 1]).send('alice')
                ).rejects.toThrow('eosio_assert: contract is disabled')
            })

            test('requires valid vote_type (0 or 1)', async () => {
                await expect(
                    contracts.sentiment.actions.voteaccount(['alice', 'bob', 2]).send('alice')
                ).rejects.toThrow('eosio_assert: vote_type must be 0 (opposition) or 1 (support)')
            })

            test('missing authorization', async () => {
                await expect(
                    contracts.sentiment.actions.voteaccount(['alice', 'bob', 1]).send('bob')
                ).rejects.toThrow()
            })
        })
    })

    describe('action: rmacctvote', () => {
        describe('success', () => {
            test('user can remove their support vote', async () => {
                await contracts.sentiment.actions.voteaccount([alice, bob, 1]).send(alice)

                let votes = await contracts.sentiment.tables
                    .accountvotes(Name.from(bob).value.value)
                    .getTableRows()
                expect(votes).toHaveLength(1)

                await contracts.sentiment.actions.rmacctvote([alice, bob]).send(alice)

                votes = await contracts.sentiment.tables
                    .accountvotes(Name.from(bob).value.value)
                    .getTableRows()
                expect(votes).toHaveLength(0)
            })

            test('user can remove their opposition vote', async () => {
                await contracts.sentiment.actions.voteaccount([alice, bob, 0]).send(alice)

                await contracts.sentiment.actions.rmacctvote([alice, bob]).send(alice)

                const votes = await contracts.sentiment.tables
                    .accountvotes(Name.from(bob).value.value)
                    .getTableRows()
                expect(votes).toHaveLength(0)
            })

            test('removing vote does not affect other votes', async () => {
                await contracts.sentiment.actions.voteaccount([alice, bob, 1]).send(alice)
                await contracts.sentiment.actions.voteaccount([charlie, bob, 1]).send(charlie)

                await contracts.sentiment.actions.rmacctvote([alice, bob]).send(alice)

                const votes = await contracts.sentiment.tables
                    .accountvotes(Name.from(bob).value.value)
                    .getTableRows()
                expect(votes).toHaveLength(1)
                expect(votes[0].voter).toBe('charlie')
            })
        })

        describe('validation', () => {
            test('requires contract to be enabled', async () => {
                await contracts.sentiment.actions.disable().send(sentimentContract)

                await expect(
                    contracts.sentiment.actions.rmacctvote(['alice', 'bob']).send('alice')
                ).rejects.toThrow('eosio_assert: contract is disabled')
            })

            test('requires vote to exist', async () => {
                await expect(
                    contracts.sentiment.actions.rmacctvote(['alice', 'bob']).send('alice')
                ).rejects.toThrow('eosio_assert: vote does not exist')
            })

            test('missing authorization', async () => {
                await contracts.sentiment.actions.voteaccount([alice, bob, 1]).send(alice)

                await expect(
                    contracts.sentiment.actions.rmacctvote(['alice', 'bob']).send('bob')
                ).rejects.toThrow()
            })
        })
    })

    describe('action: getacctvote (read-only)', () => {
        describe('success', () => {
            test('returns vote details', async () => {
                await contracts.sentiment.actions.voteaccount([alice, bob, 1]).send(alice)

                const vote = await contracts.sentiment.actions.getacctvote([alice, bob]).read()

                expect(String(vote.voter)).toBe('alice')
                expect(String(vote.account)).toBe('bob')
                expect(Number(vote.vote_type)).toBe(1)
            })

            test('returns opposition vote', async () => {
                await contracts.sentiment.actions.voteaccount([alice, bob, 0]).send(alice)

                const vote = await contracts.sentiment.actions.getacctvote([alice, bob]).read()

                expect(String(vote.voter)).toBe('alice')
                expect(String(vote.account)).toBe('bob')
                expect(Number(vote.vote_type)).toBe(0)
            })
        })

        describe('validation', () => {
            test('requires vote to exist', async () => {
                await expect(
                    contracts.sentiment.actions.getacctvote([alice, bob]).read()
                ).rejects.toThrow('eosio_assert: vote does not exist')
            })
        })
    })

    describe('action: getactvtrs (read-only)', () => {
        describe('success', () => {
            test('returns all voters for an account', async () => {
                await contracts.sentiment.actions.voteaccount([alice, charlie, 1]).send(alice)
                await contracts.sentiment.actions.voteaccount([bob, charlie, 0]).send(bob)
                await contracts.sentiment.actions.voteaccount([charlie, charlie, 1]).send(charlie)

                const voters = await contracts.sentiment.actions.getactvtrs([charlie]).read()

                expect(voters).toHaveLength(3)
                expect(String(voters[0].voter)).toBe('alice')
                expect(String(voters[1].voter)).toBe('bob')
                expect(String(voters[2].voter)).toBe('charlie')
            })

            test('returns empty array for account with no votes', async () => {
                const voters = await contracts.sentiment.actions.getactvtrs([alice]).read()

                expect(voters).toHaveLength(0)
            })

            test('vote counts are correctly reflected', async () => {
                await contracts.sentiment.actions.voteaccount([alice, bob, 1]).send(alice)
                await contracts.sentiment.actions.voteaccount([charlie, bob, 0]).send(charlie)

                const voters = await contracts.sentiment.actions.getactvtrs([bob]).read()

                expect(voters).toHaveLength(2)
                const support = voters.filter((v) => Number(v.vote_type) === 1)
                const opposition = voters.filter((v) => Number(v.vote_type) === 0)
                expect(support).toHaveLength(1)
                expect(opposition).toHaveLength(1)
            })
        })
    })

    describe('integration', () => {
        test('vote lifecycle', async () => {
            // Alice votes support on Bob
            await contracts.sentiment.actions.voteaccount([alice, bob, 1]).send(alice)

            // getacctvote shows vote_type = 1
            let vote = await contracts.sentiment.actions.getacctvote([alice, bob]).read()
            expect(Number(vote.vote_type)).toBe(1)

            // Alice changes vote to opposition (calls voteaccount again)
            await contracts.sentiment.actions.voteaccount([alice, bob, 0]).send(alice)

            // getacctvote shows vote_type = 0
            vote = await contracts.sentiment.actions.getacctvote([alice, bob]).read()
            expect(Number(vote.vote_type)).toBe(0)

            // Alice removes vote
            await contracts.sentiment.actions.rmacctvote([alice, bob]).send(alice)

            // getacctvote throws "vote does not exist"
            await expect(
                contracts.sentiment.actions.getacctvote([alice, bob]).read()
            ).rejects.toThrow('eosio_assert: vote does not exist')
        })

        test('multiple voters on same account', async () => {
            // Multiple users vote on Bob
            await contracts.sentiment.actions.voteaccount([alice, bob, 1]).send(alice)
            await contracts.sentiment.actions.voteaccount([charlie, bob, 0]).send(charlie)

            // Get all voters
            const voters = await contracts.sentiment.actions.getactvtrs([bob]).read()

            expect(voters).toHaveLength(2)
            const support = voters.filter((v) => Number(v.vote_type) === 1)
            const opposition = voters.filter((v) => Number(v.vote_type) === 0)
            expect(support).toHaveLength(1)
            expect(opposition).toHaveLength(1)
        })

        test('votes on different accounts are isolated', async () => {
            // Alice votes on Bob
            await contracts.sentiment.actions.voteaccount([alice, bob, 1]).send(alice)

            // Alice votes on Charlie
            await contracts.sentiment.actions.voteaccount([alice, charlie, 0]).send(alice)

            // Bob's voters should only show Alice
            const bobVoters = await contracts.sentiment.actions.getactvtrs([bob]).read()
            expect(bobVoters).toHaveLength(1)
            expect(String(bobVoters[0].voter)).toBe('alice')
            expect(Number(bobVoters[0].vote_type)).toBe(1)

            // Charlie's voters should only show Alice
            const charlieVoters = await contracts.sentiment.actions.getactvtrs([charlie]).read()
            expect(charlieVoters).toHaveLength(1)
            expect(String(charlieVoters[0].voter)).toBe('alice')
            expect(Number(charlieVoters[0].vote_type)).toBe(0)
        })

        test('contract disabled blocks voting but not reads', async () => {
            // Vote while enabled
            await contracts.sentiment.actions.voteaccount([alice, bob, 1]).send(alice)

            // Disable contract
            await contracts.sentiment.actions.disable().send(sentimentContract)

            // Voting fails
            await expect(
                contracts.sentiment.actions.voteaccount([charlie, bob, 1]).send(charlie)
            ).rejects.toThrow('eosio_assert: contract is disabled')

            // Removing vote fails
            await expect(
                contracts.sentiment.actions.rmacctvote([alice, bob]).send(alice)
            ).rejects.toThrow('eosio_assert: contract is disabled')

            // Read-only actions still work
            const vote = await contracts.sentiment.actions.getacctvote([alice, bob]).read()
            expect(String(vote.voter)).toBe('alice')

            const voters = await contracts.sentiment.actions.getactvtrs([bob]).read()
            expect(voters).toHaveLength(1)
        })
    })
})
