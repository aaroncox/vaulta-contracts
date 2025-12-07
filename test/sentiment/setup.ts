import {Name, PermissionLevel, Serializer, TimePointSec, Transaction} from '@wharfkit/antelope'
import {blockchain} from '../helpers'

export const sentimentContract = 'sentiment'
export const msigContract = 'eosio.msig'
export const alice = 'alice'
export const bob = 'bob'
export const charlie = 'charlie'

export const contracts = {
    sentiment: blockchain.createContract(
        sentimentContract,
        `./contracts/sentiment/build/sentiment`,
        true
    ),
    msig: blockchain.createContract(msigContract, `./shared/include/eosio.msig/eosio.msig`, true),
}

export async function resetContracts() {
    await blockchain.resetTables()
    blockchain.createAccounts(alice, bob, charlie)
    await contracts.sentiment.actions.reset().send()
    await contracts.sentiment.actions.enable().send(sentimentContract)
}

/**
 * Helper function to create a mock msig proposal for testing
 * Since eosio.msig's propose action uses check_transaction_authorization which is not
 * implemented in Vert, we use Vert's TableView to directly insert proposal rows.
 * @param proposer - The account proposing the transaction
 * @param proposalName - Name of the proposal
 */
export async function createMsigProposal(proposer: string, proposalName: string) {
    // Use Vert's TableView.set to insert the proposal row directly
    const scope = Name.from(proposer).value.value
    const primaryKey = Name.from(proposalName).value.value
    const payer = Name.from(proposer)

    // Access the proposals table and insert the row
    const tableView = contracts.msig.tables.proposal(scope)
    tableView.set(primaryKey, payer, {
        proposal_name: proposalName,
        packed_transaction: '00',
    })
}

/**
 * Get the msig votes table scope
 * The table is scoped by the proposal (subject being voted on)
 * Must match the get_proposal_scope() function in sentiment.cpp
 * @param proposer - The account proposing the transaction
 * @param proposalName - Name of the proposal
 * @returns The scope value for the msigvotes table
 */
export function getMsigVotesScope(proposer: string, proposalName: string): bigint {
    const proposerValue = BigInt(Name.from(proposer).value.value)
    const proposalValue = BigInt(Name.from(proposalName).value.value)
    // Combine into uint128: (proposer << 64) | proposal
    const combined = (proposerValue << 64n) | proposalValue
    // XOR upper and lower 64 bits to get uint64 scope
    const upper = combined >> 64n
    const lower = combined & 0xffffffffffffffffn
    return upper ^ lower
}
