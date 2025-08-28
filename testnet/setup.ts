import {
    batch,
    mockReceiverContract,
    mockReceiverSession,
    registryContract,
    registrySession,
    systemtokenContract,
    tokensContract,
    tokensSession,
    transact,
    userSession,
} from './common'

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
            precision: 2,
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
