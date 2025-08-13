import {Blockchain} from '@proton/vert'
import {TimePointSec} from '@greymass/eosio'

import * as ApiContract from '../codegen/api.ts'
import * as RegistryContract from '../codegen/registry.ts'

export const api = ApiContract
export const registry = RegistryContract

export const blockchain = new Blockchain()
export const alice = 'alice'
export const bob = 'bob'
blockchain.createAccounts(bob, alice)

export const apiContract = 'api'
export const registryContract = 'registry'

export const contracts = {
    api: blockchain.createContract(apiContract, `./contracts/api/build/api`, true),
    registry: blockchain.createContract(
        registryContract,
        `./contracts/registry/build/registry`,
        true
    ),
}

export async function resetContracts() {
    await contracts.api.actions.reset().send()
    await contracts.registry.actions.reset().send()
}

export function advanceTime(seconds: number) {
    const newDate = new Date(blockchain.timestamp.toMilliseconds() + seconds * 1000)
    blockchain.setTime(TimePointSec.from(newDate))
}
