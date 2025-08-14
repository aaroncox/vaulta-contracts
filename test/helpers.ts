import {Blockchain} from '@proton/vert'
import {Asset, Name, TimePointSec} from '@greymass/eosio'

import * as ApiContract from '../codegen/api.ts'
import * as RegistryContract from '../codegen/registry.ts'
import * as TokenContract from '../codegen/eosio.token.ts'

export const api = ApiContract
export const registry = RegistryContract

export const blockchain = new Blockchain()
export const alice = 'alice'
export const bob = 'bob'

export const defaultSystemTokenContract = 'core.vaulta'
export const defaultSystemTokenSymbol = '4,A'
export const defaultFeesAccount = 'eosio.fees'
export const defaultInitialBalance = Asset.fromFloat(1000, defaultSystemTokenSymbol)

export const apiContract = 'api'
export const registryContract = 'registry'

export const contracts = {
    api: blockchain.createContract(apiContract, `./contracts/api/build/api`, true),
    registry: blockchain.createContract(
        registryContract,
        `./contracts/registry/build/registry`,
        true
    ),
    token: blockchain.createContract(
        'core.vaulta',
        './shared/include/eosio.token/eosio.token',
        true
    ),
    faketoken: blockchain.createContract(
        'fake.token',
        './shared/include/eosio.token/eosio.token',
        true
    ),
}

export async function resetContracts() {
    await blockchain.resetTables()
    blockchain.createAccounts(alice, bob, defaultFeesAccount)

    // System token setup
    const supply = Asset.fromFloat(1000000000, defaultSystemTokenSymbol)
    await contracts.token.actions.create([defaultSystemTokenContract, String(supply)]).send()
    await contracts.token.actions.issue([defaultSystemTokenContract, String(supply), '']).send()

    await contracts.token.actions
        .transfer([defaultSystemTokenContract, 'alice', String(defaultInitialBalance), ''])
        .send()
    await contracts.token.actions
        .transfer([defaultSystemTokenContract, 'bob', String(defaultInitialBalance), ''])
        .send()
    await contracts.token.actions
        .open([defaultFeesAccount, defaultSystemTokenSymbol, defaultFeesAccount])
        .send('eosio.fees')

    // Secondary token on primary contract for testing
    const secondarySupply = Asset.fromFloat(1000000000, '4,B')
    await contracts.token.actions
        .create([defaultSystemTokenContract, String(secondarySupply)])
        .send()
    await contracts.token.actions
        .issue([defaultSystemTokenContract, String(secondarySupply), ''])
        .send()
    await contracts.token.actions
        .transfer([defaultSystemTokenContract, 'alice', '1000.0000 B', ''])
        .send()

    // Fake token contract mimicing system token for testing
    const fakesupply = `1000000000.0000 A`
    await contracts.faketoken.actions.create(['fake.token', fakesupply]).send()
    await contracts.faketoken.actions.issue(['fake.token', fakesupply, '']).send()
    await contracts.faketoken.actions.transfer(['fake.token', alice, '1000.0000 A', '']).send()
    await contracts.faketoken.actions.transfer(['fake.token', bob, '1000.0000 A', '']).send()

    // Set base configuration for testing
    await setRegistryConfig()
}

export function advanceTime(seconds: number) {
    const newDate = new Date(blockchain.timestamp.toMilliseconds() + seconds * 1000)
    blockchain.setTime(TimePointSec.from(newDate))
}

export async function setRegistryConfig() {
    await contracts.registry.actions
        .setconfig([
            true,
            {
                contract: defaultSystemTokenContract,
                symbol: defaultSystemTokenSymbol,
            },
            {
                receiver: defaultFeesAccount,
                regtoken: Asset.fromFloat(1, defaultSystemTokenSymbol),
            },
        ])
        .send()
}

export function getTokenBalance(account: string) {
    const scope = Name.from(account).value.value
    const primary_key = Asset.Symbol.from(defaultSystemTokenSymbol).code.value.value
    const row = contracts.token.tables
        .accounts(scope)
        .getTableRow(primary_key) as TokenContract.Types.account
    if (!row) throw new Error('Balance not found')
    return Asset.from(row.balance)
}
