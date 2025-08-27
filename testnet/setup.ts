import {Action, AnyAction, APIClient} from '@wharfkit/antelope'

import {Contract as MockReceiverContract} from '../codegen/mockreceiver'
import {Contract as RegistryContract} from '../codegen/registry'
import {Contract as TokenContract} from '../codegen/token'
import {Contract as TokensContract} from '../codegen/tokens'
import {Chains, Session} from '@wharfkit/session'
import {WalletPluginPrivateKey} from '@wharfkit/wallet-plugin-privatekey'

const client = new APIClient({url: process.env.TESTNET_NODE_URL})
const chain = Chains.Jungle4

const mockReceiverContract = new MockReceiverContract({
    account: process.env.MOCKRECEIVER_TESTNET_ACCOUNT,
    client,
})
const registryContract = new RegistryContract({
    account: process.env.REGISTRY_TESTNET_ACCOUNT,
    client,
})
const systemtokenContract = new TokenContract({
    account: process.env.TESTNET_SYSTEMTOKEN_ACCOUNT,
    client,
})
const tokensContract = new TokensContract({account: process.env.TOKENS_TESTNET_ACCOUNT, client})

const walletPlugin = new WalletPluginPrivateKey(process.env.TESTNET_PRIVATE_KEY)

const userSession = new Session({
    chain,
    actor: process.env.TESTNET_TEST_ACCOUNT,
    permission: 'active',
    walletPlugin,
})

const mockReceiverSession = new Session({
    chain,
    actor: process.env.MOCKRECEIVER_TESTNET_ACCOUNT,
    permission: 'active',
    walletPlugin,
})

const registrySession = new Session({
    chain,
    actor: process.env.REGISTRY_TESTNET_ACCOUNT,
    permission: 'active',
    walletPlugin,
})

const tokensSession = new Session({
    chain,
    actor: process.env.TOKENS_TESTNET_ACCOUNT,
    permission: 'active',
    walletPlugin,
})

async function transact(session: Session, action: Action, description: string) {
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

interface BatchAction {
    action: Action
    description: string
}

async function batch(session: Session, actions: BatchAction[]) {
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

// Retrieve all tokens and accounts in the contract
const accounts: string[] = []
const symbols: string[] = []
const tokens = await registryContract.table('tokens').all()
for (const token of tokens) {
    symbols.push(`${token.precision},${token.ticker}`)
    const scopes = await tokensContract.table('accounts').scopes().all()
    scopes.forEach((scope) => {
        accounts.push(String(scope.scope))
    })
}
const uniqueAccounts = [...new Set(accounts)]

// Reset them all
await transact(
    tokensSession,
    tokensContract.action('reset', {
        testaccounts: uniqueAccounts,
        testsymbols: symbols,
    }),
    `Call \`${process.env.TOKENS_CONTRACT_NAME}::reset\` as \`${tokensSession.actor}\` to reset the token contract.`
)

await transact(
    registrySession,
    registryContract.action('reset', {}),
    `Call \`${process.env.REGISTRY_CONTRACT_NAME}::reset\` as \`${registrySession.actor}\` to reset the registry contract.`
)

await transact(
    mockReceiverSession,
    mockReceiverContract.action('reset', {}),
    `Call \`${process.env.MOCKRECEIVER_CONTRACT_NAME}::reset\` as \`${mockReceiverSession.actor}\` to reset the mock receiver contract.`
)

await batch(registrySession, [
    {
        action: registryContract.action('setconfig', {
            config: {
                enabled: true,
                fees: {
                    token: {
                        contract: 'eosio.token',
                        symbol: '4,EOS',
                    },
                    receiver: 'gm',
                    regtoken: process.env.REGISTRY_FEE_AMOUNT,
                },
                regtoken: {
                    minlength: 3,
                },
            },
        }),
        description: `Call \`${process.env.REGISTRY_CONTRACT_NAME}::setconfig\` as \`${registrySession.actor}\` to set contracts configuration.`,
    },
    {
        action: registryContract.action('addcontract', {
            contract: process.env.TOKENS_TESTNET_ACCOUNT,
        }),
        description: `Call \`${process.env.REGISTRY_CONTRACT_NAME}::addcontract\` as \`${registrySession.actor}\` to whitelist the \`${process.env.TOKENS_CONTRACT_NAME}\` token contract.`,
    },
])

await transact(
    tokensSession,
    tokensContract.action('setconfig', {
        registry: process.env.REGISTRY_TESTNET_ACCOUNT,
    }),
    `Call \`${process.env.TOKENS_CONTRACT_NAME}::setconfig\` as \`${tokensSession.actor}\` to set \`${process.env.REGISTRY_CONTRACT_NAME}\` as the registry contract on token contract.`
)

await transact(
    mockReceiverSession,
    mockReceiverContract.action('setconfig', {
        tokencontract: process.env.TOKENS_TESTNET_ACCOUNT,
        sender: process.env.TOKENS_TESTNET_ACCOUNT,
        destination: process.env.MOCKRECEIVER_DESTINATION,
    }),
    `Call \`${process.env.MOCKRECEIVER_CONTRACT_NAME}::setconfig\` as \`${mockReceiverSession.actor}\` to configure the mock receiver contract.`
)

await batch(userSession, [
    {
        action: registryContract.action('openbalance', {
            account: process.env.TESTNET_TEST_ACCOUNT,
        }),
        description: `Call \`${process.env.REGISTRY_CONTRACT_NAME}::openbalance\` as \`${userSession.actor}\` to open a balance to allow deposits.`,
    },
    {
        action: systemtokenContract.action('transfer', {
            from: userSession.actor,
            to: process.env.REGISTRY_TESTNET_ACCOUNT,
            quantity: process.env.REGISTRY_FEE_AMOUNT,
            memo: '',
        }),
        description: `Call \`${process.env.TESTNET_SYSTEMTOKEN_ACCOUNT}::transfer\` as \`${userSession.actor}\` to send ${process.env.REGISTRY_FEE_AMOUNT} to \`${process.env.REGISTRY_TESTNET_ACCOUNT}\` as a deposit.`,
    },
    {
        action: registryContract.action('regtoken', {
            ticker: 'FOO',
            creator: userSession.actor,
            payment: process.env.REGISTRY_FEE_AMOUNT,
        }),
        description: `Call \`${process.env.REGISTRY_CONTRACT_NAME}::regtoken\` as \`${userSession.actor}\` to reserve the FOO token symbol and pay the ${process.env.REGISTRY_FEE_AMOUNT} fee.`,
    },
    {
        action: registryContract.action('setcontract', {
            ticker: 'FOO',
            contract: process.env.TOKENS_TESTNET_ACCOUNT,
        }),
        description: `Call \`${process.env.REGISTRY_CONTRACT_NAME}::setcontract\` as \`${userSession.actor}\` to define the \`${process.env.TOKENS_TESTNET_ACCOUNT}\` contract this token will use.`,
    },
    {
        action: tokensContract.action('setsupply', {
            ticker: 'FOO',
            supply: '1000000.00 FOO',
        }),
        description: `Call \`${process.env.TOKENS_CONTRACT_NAME}::setsupply\` as \`${userSession.actor}\` to set the token supply and establish the data for the token in the token contracts table.`,
    },
    {
        action: tokensContract.action('open', {
            owner: process.env.MOCKRECEIVER_TESTNET_ACCOUNT,
            symbol: '2,FOO',
            ram_payer: userSession.actor,
        }),
        description: `Call \`${process.env.TOKENS_CONTRACT_NAME}::open\` as \`${userSession.actor}\` for the \`${process.env.MOCKRECEIVER_TESTNET_ACCOUNT}\` account.`,
    },
    {
        action: tokensContract.action('open', {
            owner: 'eosio',
            symbol: '2,FOO',
            ram_payer: userSession.actor,
        }),
        description: `Call \`${process.env.TOKENS_CONTRACT_NAME}::open\` as \`${userSession.actor}\` for the \`eosio\` account.`,
    },
    {
        action: tokensContract.action('open', {
            owner: process.env.MOCKRECEIVER_DESTINATION,
            symbol: '2,FOO',
            ram_payer: userSession.actor,
        }),
        description: `Call \`${process.env.TOKENS_CONTRACT_NAME}::open\` as \`${userSession.actor}\` for the \`${process.env.MOCKRECEIVER_DESTINATION}\` account.`,
    },
    {
        action: tokensContract.action('distribute', {
            ticker: 'FOO',
            allocations: [
                {
                    receiver: process.env.MOCKRECEIVER_TESTNET_ACCOUNT,
                    quantity: '999000.00 FOO',
                },
                {
                    receiver: 'eosio',
                    quantity: '1000.00 FOO',
                },
            ],
        }),
        description: `Call \`${process.env.TOKENS_CONTRACT_NAME}::distribute\` as \`${userSession.actor}\` to distribute the FOO tokens.`,
    },
])
