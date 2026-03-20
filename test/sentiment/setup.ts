import {Asset, Name} from '@wharfkit/antelope'
import {blockchain} from '../helpers'

export const sentimentContract = 'sentiment'
export const msigContract = 'eosio.msig'
export const tokenContract = 'core.vaulta'
export const faketokenContract = 'fake.token'
export const feeReceiver = 'eosio.fees'
export const alice = 'alice'
export const bob = 'bob'
export const charlie = 'charlie'

export const defaultTokenSymbol = '4,A'
export const topicFee = Asset.fromFloat(1, defaultTokenSymbol)
export const defaultInitialBalance = Asset.fromFloat(1000, defaultTokenSymbol)

export const defaultSetconfigArgs = [
    'eosio',
    tokenContract,
    'transfer',
    defaultTokenSymbol,
    feeReceiver,
    String(topicFee),
]

export const contracts = {
    sentiment: blockchain.createContract(
        sentimentContract,
        `./contracts/sentiment/build/sentiment`,
        true
    ),
    msig: blockchain.createContract(msigContract, `./shared/include/eosio.msig/eosio.msig`, true),
    token: blockchain.createContract(tokenContract, './shared/include/eosio.token/eosio.token', true),
    faketoken: blockchain.createContract(
        faketokenContract,
        './shared/include/eosio.token/eosio.token',
        true
    ),
}

export async function resetContracts() {
    await blockchain.resetTables()
    blockchain.createAccounts(alice, bob, charlie, feeReceiver)

    const supply = Asset.fromFloat(1000000000, defaultTokenSymbol)
    await contracts.token.actions.create([tokenContract, String(supply)]).send()
    await contracts.token.actions.issue([tokenContract, String(supply), '']).send()

    await contracts.token.actions
        .transfer([tokenContract, alice, String(defaultInitialBalance), ''])
        .send()
    await contracts.token.actions
        .transfer([tokenContract, bob, String(defaultInitialBalance), ''])
        .send()
    await contracts.token.actions
        .transfer([tokenContract, charlie, String(defaultInitialBalance), ''])
        .send()
    await contracts.token.actions
        .open([feeReceiver, defaultTokenSymbol, feeReceiver])
        .send(feeReceiver)

    const fakesupply = '1000000000.0000 A'
    await contracts.faketoken.actions.create([faketokenContract, fakesupply]).send()
    await contracts.faketoken.actions.issue([faketokenContract, fakesupply, '']).send()
    await contracts.faketoken.actions.transfer([faketokenContract, alice, '1000.0000 A', '']).send()
    await contracts.faketoken.actions.transfer([faketokenContract, bob, '1000.0000 A', '']).send()

    await contracts.sentiment.actions.reset().send()
    await contracts.sentiment.actions.setconfig(defaultSetconfigArgs).send(sentimentContract)
    await contracts.sentiment.actions.enable().send(sentimentContract)
}

export async function openBalance(account: string) {
    const balances = contracts.sentiment.tables.balance(Name.from(sentimentContract).value.value)
    const row = balances.getTableRow(Name.from(account).value.value)
    if (!row) {
        await contracts.sentiment.actions.open([account]).send(account)
    }
}

export async function depositTokens(account: string, amount: string) {
    await openBalance(account)
    await contracts.token.actions
        .transfer([account, sentimentContract, amount, ''])
        .send(account)
}

export async function createTopic(creator: string, id: string, description: string) {
    await depositTokens(creator, String(topicFee))
    await contracts.sentiment.actions
        .createtopic([creator, id, description, String(topicFee)])
        .send(creator)
}

/**
 * Helper function to create a mock msig proposal for testing
 * Since eosio.msig's propose action uses check_transaction_authorization which is not
 * implemented in Vert, we use Vert's TableView to directly insert proposal rows.
 * @param proposer - The account proposing the transaction
 * @param proposalName - Name of the proposal
 */
export async function createMsigProposal(proposer: string, proposalName: string) {
    const scope = Name.from(proposer).value.value
    const primaryKey = Name.from(proposalName).value.value
    const payer = Name.from(proposer)

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
    const combined = (proposerValue << 64n) | proposalValue
    const upper = combined >> 64n
    const lower = combined & 0xffffffffffffffffn
    return upper ^ lower
}
