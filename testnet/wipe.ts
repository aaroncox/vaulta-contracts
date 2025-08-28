import {
    mockReceiverContract,
    mockReceiverSession,
    registryContract,
    registrySession,
    tokensContract,
    tokensSession,
    transact,
} from './common'

// Retrieve all accounts and symbols on the testnet
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

// Reset all accounts and symbols in the tokens contract
await transact(
    tokensSession,
    tokensContract.action('reset', {
        testaccounts: uniqueAccounts,
        testsymbols: symbols,
    }),
    `Call \`${process.env.TOKENS_CONTRACT_NAME}::reset\` as \`${tokensSession.actor}\` to reset the token contract.`
)

// Reset the registry
await transact(
    registrySession,
    registryContract.action('reset', {}),
    `Call \`${process.env.REGISTRY_CONTRACT_NAME}::reset\` as \`${registrySession.actor}\` to reset the registry contract.`
)

// Reset the mock receiver
await transact(
    mockReceiverSession,
    mockReceiverContract.action('reset', {}),
    `Call \`${process.env.MOCKRECEIVER_CONTRACT_NAME}::reset\` as \`${mockReceiverSession.actor}\` to reset the mock receiver contract.`
)
