import {Action, APIClient} from '@wharfkit/antelope'

import {Contract as MockReceiverContract} from '../codegen/mockreceiver'
import {Contract as RegistryContract} from '../codegen/registry'
import {Contract as TokenContract} from '../codegen/token'
import {Contract as TokensContract} from '../codegen/tokens'
import {Chains, Session} from '@wharfkit/session'
import {WalletPluginPrivateKey} from '@wharfkit/wallet-plugin-privatekey'

if (!process.env.TESTNET_PRIVATE_KEY) {
    throw new Error('TESTNET_PRIVATE_KEY environment variable is not set')
}

export const client = new APIClient({url: process.env.TESTNET_NODE_URL})
export const chain = Chains.Jungle4

export const mockReceiverContract = new MockReceiverContract({
    account: process.env.MOCKRECEIVER_TESTNET_ACCOUNT,
    client,
})
export const registryContract = new RegistryContract({
    account: process.env.REGISTRY_TESTNET_ACCOUNT,
    client,
})
export const systemtokenContract = new TokenContract({
    account: process.env.TESTNET_SYSTEMTOKEN_ACCOUNT,
    client,
})
export const tokensContract = new TokensContract({
    account: process.env.TOKENS_TESTNET_ACCOUNT,
    client,
})

export const walletPlugin = new WalletPluginPrivateKey(process.env.TESTNET_PRIVATE_KEY)

export const userSession = new Session({
    chain,
    actor: process.env.TESTNET_TEST_ACCOUNT,
    permission: 'active',
    walletPlugin,
})

export const mockReceiverSession = new Session({
    chain,
    actor: process.env.MOCKRECEIVER_TESTNET_ACCOUNT,
    permission: 'active',
    walletPlugin,
})

export const registrySession = new Session({
    chain,
    actor: process.env.REGISTRY_TESTNET_ACCOUNT,
    permission: 'active',
    walletPlugin,
})

export const tokensSession = new Session({
    chain,
    actor: process.env.TOKENS_TESTNET_ACCOUNT,
    permission: 'active',
    walletPlugin,
})

export async function transact(session: Session, action: Action, description: string) {
    console.log(`\n## ${action.account}::${action.name}`)
    console.log(`\n${description}`)
    console.log(`\n\`\`\``)
    console.log(JSON.stringify(action.decoded, null, 2))
    console.log(`\n\`\`\``)
    const result = await session.transact({action})
    if (!result.resolved) throw new Error('Transaction failed')
    console.log(
        `[Transaction Result](https://jungle4.unicove.com/transaction/${result.resolved.transaction.id})`
    )
    await new Promise((resolve) => setTimeout(resolve, 1000))
}

export interface BatchAction {
    action: Action
    description: string
}

export async function batch(session: Session, actions: BatchAction[]) {
    const queue: Action[] = []
    for (const {action, description} of actions) {
        console.log(`\n## ${action.account}::${action.name}`)
        console.log(`\n${description}`)
        console.log(`\n\`\`\``)
        console.log(JSON.stringify(action.decoded, null, 2))
        console.log(`\n\`\`\``)
        queue.push(action)
    }

    const result = await session.transact({actions: queue})
    if (!result.resolved) throw new Error('Transaction failed')
    console.log(
        `[Transaction Result](https://jungle4.unicove.com/transaction/${result.resolved.transaction.id})`
    )
    await new Promise((resolve) => setTimeout(resolve, 1000))
}
