import {blockchain} from '../helpers'

export const sentimentContract = 'sentiment'

export const contracts = {
    sentiment: blockchain.createContract(
        sentimentContract,
        `./contracts/sentiment/build/sentiment`,
        true
    ),
}

export async function resetContracts() {
    await blockchain.resetTables()
    blockchain.createAccounts('alice', 'bob', 'charlie')
    await contracts.sentiment.actions.reset().send()
    await contracts.sentiment.actions.enable().send(sentimentContract)
}
