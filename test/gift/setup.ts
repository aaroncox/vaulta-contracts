import {Name, PermissionLevel, Serializer, Transaction} from '@wharfkit/antelope'
import {blockchain} from '../helpers'

export const giftContract = 'ram.vaulta'
export const alice = 'alice'
export const bob = 'bob'
export const newuser = 'newuser'

export const contracts = {
    gift: blockchain.createContract(giftContract, './contracts/gift/build/gift', true),
    system: blockchain.createContract('eosio', './contracts/mocksystem/build/mocksystem', true),
}

export async function resetContracts() {
    await blockchain.resetTables()
    blockchain.createAccounts(alice, bob, newuser)
}

export function getOperator(account: string) {
    return contracts.gift.tables
        .operators(Name.from(giftContract).value.value)
        .getTableRow(Name.from(account).value.value)
}

type MockContract = (typeof contracts)[keyof typeof contracts]

export function packAction(contract: MockContract, action: string, data: object, actor: string) {
    return {
        account: contract.name,
        name: Name.from(action),
        data: Serializer.encode({abi: contract.abi, type: action, object: data}).array,
        authorization: [PermissionLevel.from(`${actor}@active`)],
    }
}

export function sendActions(...actions: ReturnType<typeof packAction>[]) {
    return blockchain.applyTransaction(
        Transaction.from({actions, expiration: 0, ref_block_num: 0, ref_block_prefix: 0})
    )
}

export function giftInTx(op: string, to: string, bytes: number | string, memo = '') {
    return sendActions(
        packAction(contracts.system, 'newaccount', {creator: op, account: to}, op),
        packAction(contracts.gift, 'giftacct', {op, to, bytes, memo}, op)
    )
}
