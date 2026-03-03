import {
    API,
    Asset,
    Authority,
    Name,
    PermissionLevel,
    PublicKey,
    PublicKeyType,
    Serializer,
    Transaction,
    UInt16,
    UInt64,
} from '@wharfkit/antelope'
import {blockchain} from '../helpers'

export const lightacctContract = 'lightacct'
export const keyhostAccount = 'keyhost'
export const systemContract = 'eosio'
export const tokenContract = 'core.vaulta'
export const coreSymbol = '4,A'

export const alice = 'alice'
export const bob = 'bob'

export const testKey1 = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV'
export const testKey2 = 'EOS8dzGxC6h2nWx9j8yC7sgV2M7wqv6pch46p1QpVBY2ofGNLhTNf'

export const contracts = {
    lightacct: blockchain.createContract(
        lightacctContract,
        `./contracts/lightacct/build/lightacct`,
        true
    ),
    token: blockchain.createContract(
        tokenContract,
        './shared/include/eosio.token/eosio.token',
        true
    ),
    system: blockchain.createContract(
        systemContract,
        './contracts/mocksystem/build/mocksystem',
        true
    ),
}

export function permissionFromId(id: number): string {
    return String(Name.from(UInt64.from(id)))
}

function setupRamMarket() {
    const systemAccount = blockchain.getAccount(Name.from(systemContract))
    if (!systemAccount || !systemAccount.abi) return

    const rammarketTable = systemAccount.tables['rammarket']
    if (!rammarketTable) return

    const ramcoreSymbolCode = Asset.SymbolCode.from('RAMCORE')
    const primaryKey = (BigInt(ramcoreSymbolCode.value.value) << 8n) | 4n
    const scope = Name.from(systemContract).value.value
    rammarketTable(scope).set(primaryKey, Name.from(systemContract), {
        supply: '10000000000.0000 RAMCORE',
        base: {
            balance: '68719476736 RAM',
            weight: '0.50000000000000000',
        },
        quote: {
            balance: '1000000.0000 A',
            weight: '0.50000000000000000',
        },
    })
}

function addCodePermission(account: string, contractName: string) {
    const acct = blockchain.getAccount(Name.from(account))
    if (!acct) return
    const activePerm = acct.permissions.find((p: API.v1.AccountPermission) =>
        p.perm_name.equals(Name.from('active'))
    )
    if (!activePerm) return
    activePerm.required_auth.accounts.push({
        weight: UInt16.from(1),
        permission: PermissionLevel.from({actor: contractName, permission: 'eosio.code'}),
    } as never)
    activePerm.required_auth.sort()
}

export async function resetContracts() {
    await blockchain.resetTables()
    blockchain.createAccounts(alice, bob, keyhostAccount)

    addCodePermission(keyhostAccount, lightacctContract)
    setupRamMarket()

    const supply = Asset.fromFloat(1000000000, coreSymbol)
    await contracts.token.actions.create([tokenContract, String(supply)]).send()
    await contracts.token.actions.issue([tokenContract, String(supply), '']).send()

    await contracts.token.actions.transfer([tokenContract, alice, '10000.0000 A', '']).send()
    await contracts.token.actions.transfer([tokenContract, bob, '10000.0000 A', '']).send()

    await contracts.lightacct.actions
        .init([keyhostAccount, coreSymbol, tokenContract, systemContract])
        .send()
}

interface ActionDef {
    account: string
    name: string
    data: Record<string, unknown>
    authorization: string | string[]
}

function serializeActionData(account: string, actionName: string, data: Record<string, unknown>) {
    const acct = blockchain.getAccount(Name.from(account))
    if (!acct || !acct.abi) throw new Error(`Account ${account} has no ABI`)

    return Serializer.encode({
        abi: acct.abi,
        type: actionName,
        object: data,
    }).array
}

export async function sendTransaction(actions: ActionDef[]) {
    const txActions = actions.map((a) => {
        const auths = Array.isArray(a.authorization) ? a.authorization : [a.authorization]
        return {
            account: a.account,
            name: Name.from(a.name),
            data: serializeActionData(a.account, a.name, a.data),
            authorization: auths.map((auth) => {
                const normalized = auth.includes('@') ? auth : `${auth}@active`
                return PermissionLevel.from(normalized)
            }),
        }
    })

    return blockchain.applyTransaction(
        Transaction.from({
            actions: txActions,
            expiration: 0,
            ref_block_num: 0,
            ref_block_prefix: 0,
        })
    )
}

function addKeyhostPermission(credentialId: number) {
    const keyhostAcct = blockchain.getAccount(Name.from(keyhostAccount))
    if (!keyhostAcct) return

    const permName = Name.from(UInt64.from(credentialId))
    const existing = keyhostAcct.permissions || []

    const alreadyExists = existing.some((p: API.v1.AccountPermission) =>
        p.perm_name.equals(permName)
    )
    if (alreadyExists) return

    keyhostAcct.setPermissions([
        ...existing,
        API.v1.AccountPermission.from({
            perm_name: permName,
            parent: 'active',
            required_auth: Authority.from({
                threshold: 1,
                keys: [],
                accounts: [],
                waits: [],
            }),
        }),
    ])
}

export async function deposit(sender: string, amount: string, key: PublicKeyType) {
    await contracts.token.actions.transfer([sender, lightacctContract, amount, key]).send(sender)

    const credentials = getCredentials()
    for (const cred of credentials) {
        addKeyhostPermission(Number(cred.id))
    }
}

function authAction(
    credentialId: number,
    actionName: string,
    actionData: Record<string, unknown>,
    credentialIds?: number[]
) {
    const permName = permissionFromId(credentialId)
    const authIds = credentialIds ?? [credentialId]
    const authkeyAuths = authIds.map((id) => `${keyhostAccount}@${permissionFromId(id)}`)
    return sendTransaction([
        {
            account: lightacctContract,
            name: 'authkey',
            data: {credential_ids: authIds},
            authorization: authkeyAuths,
        },
        {
            account: lightacctContract,
            name: actionName,
            data: actionData,
            authorization: `${keyhostAccount}@${permName}`,
        },
    ])
}

export async function authSend(
    credentialId: number,
    toKey: PublicKeyType,
    quantity: string,
    memo: string = '',
    credentialIds?: number[]
) {
    return authAction(
        credentialId,
        'send',
        {from_id: credentialId, to_key: toKey, quantity, memo},
        credentialIds
    )
}

export async function authWithdraw(
    credentialId: number,
    toAccount: string,
    quantity: string,
    memo: string = '',
    credentialIds?: number[]
) {
    return authAction(
        credentialId,
        'withdraw',
        {credential_id: credentialId, to_account: toAccount, quantity, memo},
        credentialIds
    )
}

export function getCredentials() {
    return contracts.lightacct.tables
        .credentials(Name.from(lightacctContract).value.value)
        .getTableRows()
}

export function getCredentialId(key: PublicKeyType): number {
    const creds = getCredentials()
    const match = creds.find((c: {key: string}) => PublicKey.from(key).equals(c.key))
    if (!match) throw new Error(`No credential found for key ${key}`)
    return Number(match.id)
}

export function getBalance(credentialId: number) {
    return contracts.lightacct.tables.balances(BigInt(credentialId)).getTableRows()
}

export function getBalanceAmount(credentialId: number): Asset | null {
    const rows = getBalance(credentialId)
    if (rows.length === 0) return null
    return Asset.from(rows[0].balance)
}

export function getConfig() {
    return contracts.lightacct.tables
        .config(Name.from(lightacctContract).value.value)
        .getTableRows()
}

export function getTokenBalance(account: string): Asset {
    const scope = Name.from(account).value.value
    const symbolCode = Asset.SymbolCode.from('A')
    const row = contracts.token.tables.accounts(scope).getTableRow(symbolCode.value.value) as {
        balance: string
    }
    if (!row) throw new Error('Balance not found')
    return Asset.from(row.balance)
}
