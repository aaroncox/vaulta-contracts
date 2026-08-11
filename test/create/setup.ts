import {Asset} from '@wharfkit/antelope'
import {blockchain} from '../helpers'

export const createContract = 'create.gm'
export const systemTokenContract = 'core.vaulta'
export const legacyTokenContract = 'eosio.token'
export const faketokenContract = 'fake.token'
export const alice = 'alice'

export const systemTokenSymbol = '4,A'
export const legacyTokenSymbol = '4,EOS'

export const validMemo =
    'ifgtdqcmy2ds-PUB_WA_2qwM8p4NrXqhhuka9Lmz4YWtWVUkXgx16Fpjq99r6Pk9qb77s49AenBB2S8ob8TSQk82uKGiawnWkYGX5hi'

export const contracts = {
    create: blockchain.createContract(createContract, './contracts/create/build/create', true),
    token: blockchain.createContract(
        systemTokenContract,
        './shared/include/eosio.token/eosio.token',
        true
    ),
    legacytoken: blockchain.createContract(
        legacyTokenContract,
        './shared/include/eosio.token/eosio.token',
        true
    ),
    faketoken: blockchain.createContract(
        faketokenContract,
        './shared/include/eosio.token/eosio.token',
        true
    ),
}

async function setupToken(key: string, issuer: string, symbol: string) {
    const supply = Asset.fromFloat(1000000000, symbol)
    const balance = Asset.fromFloat(1000, symbol)
    await contracts[key].actions.create([issuer, String(supply)]).send()
    await contracts[key].actions.issue([issuer, String(supply), '']).send()
    await contracts[key].actions.transfer([issuer, alice, String(balance), '']).send()
}

export async function resetContracts() {
    await blockchain.resetTables()
    blockchain.createAccounts(alice)

    await setupToken('token', systemTokenContract, systemTokenSymbol)
    await setupToken('legacytoken', legacyTokenContract, legacyTokenSymbol)
    await setupToken('faketoken', faketokenContract, systemTokenSymbol)

    await contracts.legacytoken.actions
        .transfer([legacyTokenContract, systemTokenContract, '100.0000 EOS', ''])
        .send(legacyTokenContract)
}
