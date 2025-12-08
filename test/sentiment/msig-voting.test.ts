import {beforeEach, describe, expect, test} from 'bun:test'

import {
    alice,
    bob,
    charlie,
    contracts,
    createMsigProposal,
    getMsigVotesScope,
    resetContracts,
    sentimentContract,
} from './setup'

describe('contract: sentiment - Msig Voting', () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('action: votemsig', () => {
        describe('success', () => {
            test('user can vote in support of a msig proposal', async () => {
                // Create a proposal
                await createMsigProposal(alice, 'testprop')

                // Vote on it
                await contracts.sentiment.actions
                    .votemsig([alice, alice, 'testprop', 1])
                    .send(alice)

                // Verify vote is stored
                const votes = await contracts.sentiment.tables
                    .msigvotes(getMsigVotesScope(alice, 'testprop'))
                    .getTableRows()
                expect(votes).toHaveLength(1)
                expect(votes[0].voter).toBe('alice')
                expect(votes[0].proposer).toBe('alice')
                expect(votes[0].proposal_name).toBe('testprop')
                expect(votes[0].vote_type).toBe(1)
            })

            test('user can vote in opposition to a msig proposal', async () => {
                await createMsigProposal(alice, 'testprop')

                await contracts.sentiment.actions.votemsig([bob, alice, 'testprop', 0]).send(bob)

                const votes = await contracts.sentiment.tables
                    .msigvotes(getMsigVotesScope(alice, 'testprop'))
                    .getTableRows()
                expect(votes).toHaveLength(1)
                expect(votes[0].voter).toBe('bob')
                expect(votes[0].vote_type).toBe(0)
            })

            test('multiple users can vote on the same proposal', async () => {
                await createMsigProposal(alice, 'testprop')

                await contracts.sentiment.actions
                    .votemsig([alice, alice, 'testprop', 1])
                    .send(alice)
                await contracts.sentiment.actions.votemsig([bob, alice, 'testprop', 1]).send(bob)
                await contracts.sentiment.actions
                    .votemsig([charlie, alice, 'testprop', 0])
                    .send(charlie)

                const votes = await contracts.sentiment.tables
                    .msigvotes(getMsigVotesScope(alice, 'testprop'))
                    .getTableRows()
                expect(votes).toHaveLength(3)
            })

            test('user can update their vote (upsert behavior)', async () => {
                await createMsigProposal(alice, 'testprop')

                // First vote (support)
                await contracts.sentiment.actions
                    .votemsig([alice, alice, 'testprop', 1])
                    .send(alice)

                let votes = await contracts.sentiment.tables
                    .msigvotes(getMsigVotesScope(alice, 'testprop'))
                    .getTableRows()
                expect(votes).toHaveLength(1)
                expect(votes[0].vote_type).toBe(1)

                // Second vote (opposition) - should update
                await contracts.sentiment.actions
                    .votemsig([alice, alice, 'testprop', 0])
                    .send(alice)

                votes = await contracts.sentiment.tables
                    .msigvotes(getMsigVotesScope(alice, 'testprop'))
                    .getTableRows()
                expect(votes).toHaveLength(1) // Still just one vote
                expect(votes[0].vote_type).toBe(0) // Vote type changed
            })
        })

        describe('validation', () => {
            test('requires contract to be enabled', async () => {
                await contracts.sentiment.actions.disable().send(sentimentContract)

                await expect(
                    contracts.sentiment.actions
                        .votemsig(['alice', 'alice', 'testprop', 1])
                        .send('alice')
                ).rejects.toThrow('eosio_assert: contract is disabled')
            })

            test('requires valid vote_type (0 or 1)', async () => {
                await createMsigProposal(alice, 'testprop')

                await expect(
                    contracts.sentiment.actions
                        .votemsig(['alice', 'alice', 'testprop', 2])
                        .send('alice')
                ).rejects.toThrow('eosio_assert: vote_type must be 0 (opposition) or 1 (support)')
            })

            test('requires proposal to exist in eosio.msig', async () => {
                await expect(
                    contracts.sentiment.actions
                        .votemsig(['alice', 'alice', 'nonexistent', 1])
                        .send('alice')
                ).rejects.toThrow('eosio_assert: proposal does not exist')
            })

            test('validates proposer matches on update', async () => {
                await createMsigProposal(alice, 'testprop')

                // Bob votes on Alice's proposal
                await contracts.sentiment.actions.votemsig([bob, alice, 'testprop', 1]).send(bob)

                // Bob creates his own proposal with same name
                await createMsigProposal(bob, 'testprop')

                // Bob can also vote on Bob's proposal - they're in different scopes
                await contracts.sentiment.actions.votemsig([bob, bob, 'testprop', 0]).send(bob)

                // Verify both votes exist in their respective scopes
                const aliceProposalVotes = await contracts.sentiment.tables
                    .msigvotes(getMsigVotesScope(alice, 'testprop'))
                    .getTableRows()
                expect(aliceProposalVotes).toHaveLength(1)
                expect(aliceProposalVotes[0].proposer).toBe('alice')

                const bobProposalVotes = await contracts.sentiment.tables
                    .msigvotes(getMsigVotesScope(bob, 'testprop'))
                    .getTableRows()
                expect(bobProposalVotes).toHaveLength(1)
                expect(bobProposalVotes[0].proposer).toBe('bob')
            })

            test('missing authorization', async () => {
                await createMsigProposal(alice, 'testprop')

                await expect(
                    contracts.sentiment.actions.votemsig([alice, alice, 'testprop', 1]).send(bob)
                ).rejects.toThrow()
            })
        })
    })

    describe('action: rmmsigvote', () => {
        describe('success', () => {
            test('user can remove their vote', async () => {
                await createMsigProposal(alice, 'testprop')

                // Vote
                await contracts.sentiment.actions
                    .votemsig([alice, alice, 'testprop', 1])
                    .send(alice)

                let votes = await contracts.sentiment.tables
                    .msigvotes(getMsigVotesScope(alice, 'testprop'))
                    .getTableRows()
                expect(votes).toHaveLength(1)

                // Remove vote
                await contracts.sentiment.actions.rmmsigvote([alice, alice, 'testprop']).send(alice)

                votes = await contracts.sentiment.tables
                    .msigvotes(getMsigVotesScope(alice, 'testprop'))
                    .getTableRows()
                expect(votes).toHaveLength(0)
            })

            test('removing vote does not affect other votes', async () => {
                await createMsigProposal(alice, 'testprop')

                await contracts.sentiment.actions
                    .votemsig([alice, alice, 'testprop', 1])
                    .send(alice)
                await contracts.sentiment.actions.votemsig([bob, alice, 'testprop', 1]).send(bob)

                await contracts.sentiment.actions.rmmsigvote([alice, alice, 'testprop']).send(alice)

                const votes = await contracts.sentiment.tables
                    .msigvotes(getMsigVotesScope(alice, 'testprop'))
                    .getTableRows()
                expect(votes).toHaveLength(1)
                expect(votes[0].voter).toBe('bob')
            })
        })

        describe('validation', () => {
            test('requires contract to be enabled', async () => {
                await contracts.sentiment.actions.disable().send(sentimentContract)

                await expect(
                    contracts.sentiment.actions
                        .rmmsigvote(['alice', 'alice', 'testprop'])
                        .send('alice')
                ).rejects.toThrow('eosio_assert: contract is disabled')
            })

            test('requires proposal to exist', async () => {
                await expect(
                    contracts.sentiment.actions
                        .rmmsigvote(['alice', 'alice', 'nonexistent'])
                        .send('alice')
                ).rejects.toThrow('eosio_assert: proposal does not exist')
            })

            test('requires vote to exist', async () => {
                await createMsigProposal(alice, 'testprop')

                await expect(
                    contracts.sentiment.actions
                        .rmmsigvote(['alice', 'alice', 'testprop'])
                        .send('alice')
                ).rejects.toThrow('eosio_assert: vote does not exist')
            })

            test('validates proposer matches', async () => {
                await createMsigProposal(alice, 'testprop')

                // Bob votes on alice's proposal
                await contracts.sentiment.actions.votemsig([bob, alice, 'testprop', 1]).send(bob)

                // Bob creates his own proposal with same name
                await createMsigProposal(bob, 'testprop')

                // Bob tries to remove vote with wrong proposer (Bob's vote is on Alice's proposal, not Bob's)
                await expect(
                    contracts.sentiment.actions.rmmsigvote([bob, bob, 'testprop']).send(bob)
                ).rejects.toThrow('eosio_assert: vote does not exist')
            })

            test('missing authorization', async () => {
                await createMsigProposal(alice, 'testprop')

                await contracts.sentiment.actions
                    .votemsig([alice, alice, 'testprop', 1])
                    .send(alice)

                await expect(
                    contracts.sentiment.actions.rmmsigvote([alice, alice, 'testprop']).send(bob)
                ).rejects.toThrow()
            })
        })
    })

    describe('action: getmsigvote (read-only)', () => {
        describe('success', () => {
            test('returns vote details', async () => {
                await createMsigProposal(alice, 'testprop')

                await contracts.sentiment.actions
                    .votemsig([alice, alice, 'testprop', 1])
                    .send(alice)

                const vote = await contracts.sentiment.actions
                    .getmsigvote([alice, alice, 'testprop'])
                    .read()

                expect(String(vote.voter)).toBe('alice')
                expect(String(vote.proposer)).toBe('alice')
                expect(String(vote.proposal_name)).toBe('testprop')
                expect(Number(vote.vote_type)).toBe(1)
            })
        })

        describe('validation', () => {
            test('requires proposal to exist', async () => {
                await expect(
                    contracts.sentiment.actions.getmsigvote([alice, alice, 'nonexistent']).read()
                ).rejects.toThrow('eosio_assert: proposal does not exist')
            })

            test('requires vote to exist', async () => {
                await createMsigProposal(alice, 'testprop')

                await expect(
                    contracts.sentiment.actions.getmsigvote([alice, alice, 'testprop']).read()
                ).rejects.toThrow('eosio_assert: vote does not exist')
            })

            test('requires proposer to match', async () => {
                await createMsigProposal(alice, 'testprop')

                // Bob votes on alice's proposal
                await contracts.sentiment.actions.votemsig([bob, alice, 'testprop', 1]).send(bob)

                // Bob creates his own proposal with same name
                await createMsigProposal(bob, 'testprop')

                // Try to get bob's vote with wrong proposer (Bob voted on Alice's proposal, not Bob's)
                await expect(
                    contracts.sentiment.actions.getmsigvote([bob, bob, 'testprop']).read()
                ).rejects.toThrow('eosio_assert: vote does not exist')
            })
        })
    })

    describe('action: getmsigvtrs (read-only)', () => {
        describe('success', () => {
            test('returns all voters for a proposal', async () => {
                await createMsigProposal(alice, 'testprop')

                await contracts.sentiment.actions
                    .votemsig([alice, alice, 'testprop', 1])
                    .send(alice)
                await contracts.sentiment.actions.votemsig([bob, alice, 'testprop', 0]).send(bob)
                await contracts.sentiment.actions
                    .votemsig([charlie, alice, 'testprop', 1])
                    .send(charlie)

                const voters = await contracts.sentiment.actions
                    .getmsigvtrs([alice, 'testprop'])
                    .read()

                expect(voters).toHaveLength(3)
                expect(String(voters[0].voter)).toBe('alice')
                expect(String(voters[1].voter)).toBe('bob')
                expect(String(voters[2].voter)).toBe('charlie')
            })

            test('returns empty array for proposal with no votes', async () => {
                await createMsigProposal(alice, 'testprop')

                const voters = await contracts.sentiment.actions
                    .getmsigvtrs([alice, 'testprop'])
                    .read()

                expect(voters).toHaveLength(0)
            })

            test('filters by proposer to prevent collisions', async () => {
                await createMsigProposal(alice, 'testprop')
                await createMsigProposal(bob, 'testprop')

                // Alice votes on alice's proposal
                await contracts.sentiment.actions
                    .votemsig([alice, alice, 'testprop', 1])
                    .send(alice)

                // Charlie votes on bob's proposal (different proposer, same name)
                await contracts.sentiment.actions
                    .votemsig([charlie, bob, 'testprop', 1])
                    .send(charlie)

                // Get voters for alice's proposal - should only return alice
                const aliceVoters = await contracts.sentiment.actions
                    .getmsigvtrs([alice, 'testprop'])
                    .read()
                expect(aliceVoters).toHaveLength(1)
                expect(String(aliceVoters[0].voter)).toBe('alice')

                // Get voters for bob's proposal - should only return charlie
                const bobVoters = await contracts.sentiment.actions
                    .getmsigvtrs([bob, 'testprop'])
                    .read()
                expect(bobVoters).toHaveLength(1)
                expect(String(bobVoters[0].voter)).toBe('charlie')
            })
        })

        describe('validation', () => {
            test('requires proposal to exist', async () => {
                await expect(
                    contracts.sentiment.actions.getmsigvtrs([alice, 'nonexistent']).read()
                ).rejects.toThrow('eosio_assert: proposal does not exist')
            })
        })
    })

    describe('integration', () => {
        test('multiple voters on same proposal', async () => {
            await createMsigProposal(alice, 'testprop')

            // Multiple users vote
            await contracts.sentiment.actions.votemsig([alice, alice, 'testprop', 1]).send(alice)
            await contracts.sentiment.actions.votemsig([bob, alice, 'testprop', 0]).send(bob)
            await contracts.sentiment.actions
                .votemsig([charlie, alice, 'testprop', 1])
                .send(charlie)

            // Get all voters
            const voters = await contracts.sentiment.actions.getmsigvtrs([alice, 'testprop']).read()

            expect(voters).toHaveLength(3)
            const support = voters.filter((v) => Number(v.vote_type) === 1)
            const opposition = voters.filter((v) => Number(v.vote_type) === 0)
            expect(support).toHaveLength(2)
            expect(opposition).toHaveLength(1)
        })

        test('proposal name collision prevention', async () => {
            // Proposer A creates proposal "test"
            await createMsigProposal(alice, 'test')

            // Bob votes on Alice's proposal
            await contracts.sentiment.actions.votemsig([bob, alice, 'test', 1]).send(bob)

            // Proposer B creates proposal "test" (same name, different proposer)
            await createMsigProposal(bob, 'test')

            // Bob can also vote on Bob's proposal - they're in different scopes
            await contracts.sentiment.actions.votemsig([bob, bob, 'test', 0]).send(bob)

            // Verify both votes exist in their respective scopes
            const aliceProposalVotes = await contracts.sentiment.tables
                .msigvotes(getMsigVotesScope(alice, 'test'))
                .getTableRows()
            expect(aliceProposalVotes).toHaveLength(1)
            expect(aliceProposalVotes[0].proposer).toBe('alice')
            expect(Number(aliceProposalVotes[0].vote_type)).toBe(1)

            const bobProposalVotes = await contracts.sentiment.tables
                .msigvotes(getMsigVotesScope(bob, 'test'))
                .getTableRows()
            expect(bobProposalVotes).toHaveLength(1)
            expect(bobProposalVotes[0].proposer).toBe('bob')
            expect(Number(bobProposalVotes[0].vote_type)).toBe(0)

            // This demonstrates proper scope isolation
        })

        test('vote lifecycle', async () => {
            await createMsigProposal(alice, 'testprop')

            // Alice votes support on proposal
            await contracts.sentiment.actions.votemsig([alice, alice, 'testprop', 1]).send(alice)

            // getmsigvote shows vote_type = 1
            let vote = await contracts.sentiment.actions
                .getmsigvote([alice, alice, 'testprop'])
                .read()
            expect(Number(vote.vote_type)).toBe(1)

            // Alice changes vote to opposition (calls votemsig again)
            await contracts.sentiment.actions.votemsig([alice, alice, 'testprop', 0]).send(alice)

            // getmsigvote shows vote_type = 0
            vote = await contracts.sentiment.actions.getmsigvote([alice, alice, 'testprop']).read()
            expect(Number(vote.vote_type)).toBe(0)

            // Alice removes vote
            await contracts.sentiment.actions.rmmsigvote([alice, alice, 'testprop']).send(alice)

            // getmsigvote throws "vote does not exist"
            await expect(
                contracts.sentiment.actions.getmsigvote([alice, alice, 'testprop']).read()
            ).rejects.toThrow('eosio_assert: vote does not exist')
        })
    })
})
