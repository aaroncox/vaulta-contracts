declare global {
    namespace NodeJS {
        interface ProcessEnv {
            TESTNET_NODE_URL: string
            TESTNET_TEST_ACCOUNT: string
            TESTNET_PRIVATE_KEY: string
            TESTNET_SYSTEMTOKEN_ACCOUNT: string
            API_CONTRACT_NAME: string
            API_TESTNET_ACCOUNT: string
            MOCKRECEIVER_TESTNET_ACCOUNT: string
            MOCKRECEIVER_CONTRACT_NAME: string
            MOCKRECEIVER_DESTINATION: string
            REGISTRY_CONTRACT_NAME: string
            REGISTRY_TESTNET_ACCOUNT: string
            REGISTRY_FEE_AMOUNT: string
            TOKENS_CONTRACT_NAME: string
            TOKENS_TESTNET_ACCOUNT: string
        }
    }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
