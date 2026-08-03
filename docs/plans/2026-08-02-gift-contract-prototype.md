# Gift Contract (Network RAM Gifting) Jungle 4 Prototype — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `gift` contract (operator registry + daily byte quotas + inline `eosio::giftram`) in `vaulta-contracts`, with unit tests, and demonstrate the single-signature `newaccount` + `giftacct` flow live on Jungle 4.

**Architecture:** A new contract `contracts/gift/` following the repo's `ctemplate`/`create` conventions. Approved operators are rows in an `operators` table (managed by the contract account's own authority). `giftacct` verifies the operator, debits a lazily-resetting 24-hour byte quota, and sends an inline `eosio::giftram` under the contract account's authority (via `eosio.code`). Unit tests run in `@vaulta/vert` against a minimal mock system contract deployed as `eosio` (`@vaulta/vert` 2.1.1 does not implement the privileged host intrinsics `set_parameters_packed`, `set_resource_limits`, or `set_privileged`, so the real `eosio.system` wasm fails to instantiate at all when deployed at `eosio` — this is unrelated to rammarket bootstrapping). The real end-of-transaction RAM billing behavior is proven by the Jungle 4 demo script.

**Tech Stack:** CDT (`cdt-cpp`), `@vaulta/vert` + `bun test`, `@wharfkit/session` for testnet scripts, GNU make.

**Design spec:** `~/projects/vaulta/proposals/ram-gifting-program.md`

## Global Constraints

- Contract name: `gift`; unit-test deploy account: `gift.vaulta`; Jungle 4 account: `gift.gm` (env `GIFT_TESTNET_ACCOUNT`).
- Quota window: fixed 86,400 seconds, lazy reset on next `giftacct` call.
- No per-gift cap — operator chooses bytes; the daily quota is the only limit.
- Admin actions (`addoper`, `rmoper`, `setquota`) authorized by `get_self()` only.
- Follow repo style: `namespace vaultacontracts`, `include/gift/gift.hpp` + `src/gift.cpp` + `src/debug.cpp` (DEBUG-only reset), `.clang-format` copied from `ctemplate`, Ricardian stubs (`gift.contracts.md`, `gift.clauses.md`).
- Run `make cppcheck` (clang-format) before every commit that touches C++; `make jscheck` for TS.
- Commit style (match `git log`): short imperative subject, capitalized, no trailers, no Co-Authored-By.
- Never modify `contracts/create/` or other existing contracts except the shared root `Makefile` and `.env` as specified.

---

### Task 1: Scaffold the `gift` contract

**Files:**
- Create: `contracts/gift/Makefile`, `contracts/gift/.clang-format`, `contracts/gift/.eslintrc`, `contracts/gift/.prettierrc`, `contracts/gift/README.md`
- Create: `contracts/gift/include/gift/gift.hpp`, `contracts/gift/src/gift.cpp`, `contracts/gift/src/debug.cpp`, `contracts/gift/src/gift.contracts.md`, `contracts/gift/src/gift.clauses.md`
- Modify: `.env` (append), root `Makefile` (add targets)

**Interfaces:**
- Produces: buildable contract exposing `addoper(name account, int64_t daily_quota_bytes)`, `rmoper(name account)`, `setquota(name account, int64_t daily_quota_bytes)`, `giftacct(name op, name to, int64_t bytes, string memo)`, table `operators`, DEBUG `reset()`. Tasks 3–4 implement the bodies; this task ships declarations plus empty/stub bodies so the build passes.

- [ ] **Step 1: Copy config files from ctemplate**

```bash
mkdir -p contracts/gift/include/gift contracts/gift/src
cp contracts/ctemplate/.clang-format contracts/ctemplate/.eslintrc contracts/ctemplate/.prettierrc contracts/gift/
```

- [ ] **Step 2: Append to `.env`**

```
GIFT_CONTRACT_NAME=gift
GIFT_TESTNET_ACCOUNT=gift.gm
```

- [ ] **Step 3: Write `contracts/gift/Makefile`** (same pattern as `contracts/create/Makefile`, substituting `GIFT_`)

```makefile
#!/bin/bash
include ../../.env
SHELL := /bin/bash
BIN := ./node_modules/.bin

INCLUDES = -I include -I ../../shared/include

build: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${GIFT_CONTRACT_NAME}.abi -o build/${GIFT_CONTRACT_NAME}.wasm src/${GIFT_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/debug: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${GIFT_CONTRACT_NAME}.abi -o build/${GIFT_CONTRACT_NAME}.wasm src/${GIFT_CONTRACT_NAME}.cpp -R src ${INCLUDES} -D DEBUG

build/production: | build/dir
	cdt-cpp -O=2 -abigen -abigen_output=build/${GIFT_CONTRACT_NAME}.abi -o build/${GIFT_CONTRACT_NAME}.wasm src/${GIFT_CONTRACT_NAME}.cpp -R src ${INCLUDES}

build/dir:
	mkdir -p build

clean:
	rm -rf build

testnet: build/debug
	cleos -u $(TESTNET_NODE_URL) set contract $(GIFT_TESTNET_ACCOUNT) \
		build/ ${GIFT_CONTRACT_NAME}.wasm ${GIFT_CONTRACT_NAME}.abi
```

- [ ] **Step 4: Write `contracts/gift/include/gift/gift.hpp`**

```cpp
#pragma once

#include <eosio.system/eosio.system.hpp>
#include <eosio/eosio.hpp>

using namespace eosio;
using namespace std;

namespace vaultacontracts {

class [[eosio::contract("gift")]] gift : public contract
{
public:
   using contract::contract;

   static constexpr name     SYSTEM_CONTRACT      = "eosio"_n;
   static constexpr uint32_t QUOTA_WINDOW_SECONDS = 86400;

   struct [[eosio::table("operators")]] operator_row
   {
      name           account;
      int64_t        daily_quota_bytes;
      int64_t        used_bytes;
      time_point_sec window_start;

      uint64_t primary_key() const { return account.value; }
   };

   typedef eosio::multi_index<"operators"_n, operator_row> operators_table;

   [[eosio::action]] void addoper(name account, int64_t daily_quota_bytes);
   [[eosio::action]] void rmoper(name account);
   [[eosio::action]] void setquota(name account, int64_t daily_quota_bytes);
   [[eosio::action]] void giftacct(name op, name to, int64_t bytes, string memo);

   using addoper_action  = eosio::action_wrapper<"addoper"_n, &gift::addoper>;
   using rmoper_action   = eosio::action_wrapper<"rmoper"_n, &gift::rmoper>;
   using setquota_action = eosio::action_wrapper<"setquota"_n, &gift::setquota>;
   using giftacct_action = eosio::action_wrapper<"giftacct"_n, &gift::giftacct>;

#ifdef DEBUG
   [[eosio::action]] void reset();
#endif
};

} // namespace vaultacontracts
```

- [ ] **Step 5: Write stub `contracts/gift/src/gift.cpp`**

```cpp
#include <gift/gift.hpp>

namespace vaultacontracts {

void gift::addoper(name account, int64_t daily_quota_bytes) { require_auth(get_self()); }

void gift::rmoper(name account) { require_auth(get_self()); }

void gift::setquota(name account, int64_t daily_quota_bytes) { require_auth(get_self()); }

void gift::giftacct(name op, name to, int64_t bytes, string memo) { require_auth(op); }

} // namespace vaultacontracts

#ifdef DEBUG
#include "debug.cpp"
#endif
```

- [ ] **Step 6: Write `contracts/gift/src/debug.cpp`**

```cpp
namespace vaultacontracts {

void gift::reset()
{
   require_auth(get_self());
   operators_table operators(get_self(), get_self().value);
   auto            itr = operators.begin();
   while (itr != operators.end()) {
      itr = operators.erase(itr);
   }
}

} // namespace vaultacontracts
```

- [ ] **Step 7: Write Ricardian stubs**

`contracts/gift/src/gift.contracts.md` and `contracts/gift/src/gift.clauses.md` — copy the structure from `contracts/ctemplate/src/ctemplate.contracts.md` / `.clauses.md`, retitled for `gift` with one-line descriptions per action (addoper: register an operator; rmoper: remove an operator; setquota: change an operator quota; giftacct: gift RAM to a newly created account within quota).

- [ ] **Step 8: Write `contracts/gift/README.md`** — three sentences: purpose (network RAM gifting for operator account creation), build (`make -C contracts/gift build`), test (`make test/gift` from repo root). Link the design doc path from the header of this plan.

- [ ] **Step 9: Add root `Makefile` targets** — follow the existing per-contract pattern exactly:
  - `build/gift`, `build/gift/debug`, `build/gift/production` (make -C contracts/gift ...)
  - Append `build/gift/debug` to the `build/debug` aggregate and `build/gift/production` to `build/production`
  - `.PHONY: testnet/gift` + `testnet/gift:` → `make -C contracts/gift testnet`
  - `test/gift: build/gift/debug node_modules codegen` → `bun test -t "contract: gift"`
  - Codegen: add `./codegen/gift.ts` to the `codegen` target list and a rule: `${BIN}/wharfkit generate --json ./contracts/gift/build/gift.abi --file ./codegen/gift.ts gift`

- [ ] **Step 10: Build and verify**

Run: `make build/gift/debug`
Expected: `contracts/gift/build/gift.wasm` and `gift.abi` produced; ABI contains actions `addoper`, `rmoper`, `setquota`, `giftacct`, `reset` and table `operators`.

Run: `make cppcheck`
Expected: no formatting errors (run `make format` first if needed).

- [ ] **Step 11: Commit**

```bash
git add contracts/gift .env Makefile
git commit -m "Scaffold gift contract"
```

---

### Task 2: Mock system contract for unit tests

The real `eosio.system` wasm cannot be instantiated at all under `@vaulta/vert` 2.1.1 (it lacks the privileged host intrinsics `set_parameters_packed`, `set_resource_limits`, and `set_privileged`), so tests deploy a minimal mock as `eosio` that mirrors `giftram`'s auth and single-gifter semantics (mirroring `system-contracts/contracts/eosio.system/src/delegate_bandwidth.cpp`).

**Files:**
- Create: `contracts/mocksystem/Makefile`, `contracts/mocksystem/.clang-format`, `contracts/mocksystem/include/mocksystem/mocksystem.hpp`, `contracts/mocksystem/src/mocksystem.cpp`, `contracts/mocksystem/README.md`
- Modify: root `Makefile`

**Interfaces:**
- Produces: contract deployable at `eosio` in vert with action `giftram(name from, name to, int64_t bytes, string memo)` and table `giftedram` (fields `giftee`, `gifter`, `ram_bytes`; primary key `giftee`). Task 4's tests read this table to assert the inline action fired.

- [ ] **Step 1: Copy `.clang-format` from ctemplate; write Makefile** — same Makefile as Task 1 Step 3 with `GIFT_` → `MOCKSYSTEM_` and no `testnet` target; add to `.env`: `MOCKSYSTEM_CONTRACT_NAME=mocksystem`.

- [ ] **Step 2: Write `contracts/mocksystem/include/mocksystem/mocksystem.hpp`**

```cpp
#pragma once

#include <eosio/eosio.hpp>

using namespace eosio;
using namespace std;

namespace vaultacontracts {

class [[eosio::contract("mocksystem")]] mocksystem : public contract
{
public:
   using contract::contract;

   struct [[eosio::table("giftedram")]] gifted_ram_row
   {
      name    giftee;
      name    gifter;
      int64_t ram_bytes;

      uint64_t primary_key() const { return giftee.value; }
   };

   typedef eosio::multi_index<"giftedram"_n, gifted_ram_row> gifted_ram_table;

   [[eosio::action]] void giftram(name from, name to, int64_t bytes, string memo);
};

} // namespace vaultacontracts
```

- [ ] **Step 3: Write `contracts/mocksystem/src/mocksystem.cpp`** — mirror the real checks from `delegate_bandwidth.cpp`:

```cpp
#include <mocksystem/mocksystem.hpp>

namespace vaultacontracts {

void mocksystem::giftram(name from, name to, int64_t bytes, string memo)
{
   require_auth(from);
   check(bytes > 0, "must gift positive bytes");
   check(is_account(to), "to=" + to.to_string() + " account does not exist");

   gifted_ram_table giftedram(get_self(), get_self().value);
   auto             itr = giftedram.find(to.value);
   if (itr == giftedram.end()) {
      giftedram.emplace(from, [&](auto& row) {
         row.giftee    = to;
         row.gifter    = from;
         row.ram_bytes = bytes;
      });
   } else {
      check(itr->gifter == from,
            "A single RAM gifter is allowed at any one time per account, currently holding RAM gifted by: " +
               itr->gifter.to_string());
      giftedram.modify(itr, same_payer, [&](auto& row) { row.ram_bytes += bytes; });
   }
}

} // namespace vaultacontracts
```

- [ ] **Step 4: Add root Makefile targets** — `build/mocksystem`, `build/mocksystem/debug` (append to the `build/debug` aggregate only — mocks are not part of `build/production`). No codegen entry needed.

- [ ] **Step 5: Build**

Run: `make build/mocksystem/debug && make cppcheck`
Expected: `contracts/mocksystem/build/mocksystem.wasm` + `.abi` with action `giftram`, table `giftedram`; formatting clean.

- [ ] **Step 6: Write `contracts/mocksystem/README.md`** — two sentences: test-only mock of `eosio.system` giftram semantics for vert; never deploy to a real network.

- [ ] **Step 7: Commit**

```bash
git add contracts/mocksystem .env Makefile
git commit -m "Add mock system contract for gift tests"
```

---

### Task 3: Operator registry admin actions (TDD)

**Files:**
- Create: `test/gift/setup.ts`, `test/gift/admin.test.ts`
- Modify: `contracts/gift/src/gift.cpp` (replace stubs for `addoper`, `rmoper`, `setquota`)

**Interfaces:**
- Consumes: `operators` table and action signatures from Task 1; `blockchain` helper from `test/helpers.ts`.
- Produces: `test/gift/setup.ts` exporting `giftContract = 'gift.vaulta'`, `alice`, `bob`, `contracts = {gift, system}`, `resetContracts()`, and `getOperator(account: string)` returning the raw `operators` row or undefined. Task 4 reuses all of these.

- [ ] **Step 1: Write `test/gift/setup.ts`**

```ts
import {Name} from '@wharfkit/antelope'
import {blockchain} from '../helpers'

export const giftContract = 'gift.vaulta'
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
```

- [ ] **Step 2: Write failing tests `test/gift/admin.test.ts`**

```ts
import {beforeEach, describe, expect, test} from 'bun:test'

import {alice, contracts, getOperator, resetContracts} from './setup'

describe('contract: gift - operator admin', () => {
    beforeEach(async () => {
        await resetContracts()
    })

    test('addoper registers an operator with a clean quota window', async () => {
        await contracts.gift.actions.addoper([alice, 1000000]).send()
        const row = getOperator(alice)
        expect(row).toBeDefined()
        expect(Number(row.daily_quota_bytes)).toBe(1000000)
        expect(Number(row.used_bytes)).toBe(0)
    })

    test('addoper rejects a duplicate operator', async () => {
        await contracts.gift.actions.addoper([alice, 1000000]).send()
        await expect(contracts.gift.actions.addoper([alice, 2000000]).send()).rejects.toThrow(
            'operator already registered'
        )
    })

    test('addoper rejects a non-positive quota', async () => {
        await expect(contracts.gift.actions.addoper([alice, 0]).send()).rejects.toThrow(
            'quota must be positive'
        )
    })

    test('addoper requires the contract authority', async () => {
        await expect(contracts.gift.actions.addoper([alice, 1000000]).send(alice)).rejects.toThrow(
            'missing required authority'
        )
    })

    test('setquota updates the quota', async () => {
        await contracts.gift.actions.addoper([alice, 1000000]).send()
        await contracts.gift.actions.setquota([alice, 5000000]).send()
        expect(Number(getOperator(alice).daily_quota_bytes)).toBe(5000000)
    })

    test('setquota rejects an unknown operator', async () => {
        await expect(contracts.gift.actions.setquota([alice, 5000000]).send()).rejects.toThrow(
            'operator not registered'
        )
    })

    test('rmoper removes the operator', async () => {
        await contracts.gift.actions.addoper([alice, 1000000]).send()
        await contracts.gift.actions.rmoper([alice]).send()
        expect(getOperator(alice)).toBeUndefined()
    })

    test('rmoper rejects an unknown operator', async () => {
        await expect(contracts.gift.actions.rmoper([alice]).send()).rejects.toThrow(
            'operator not registered'
        )
    })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `make test/gift`
Expected: FAIL — duplicate/unknown-operator assertions fail against the stub bodies (stubs enforce auth only).

- [ ] **Step 4: Implement admin actions in `contracts/gift/src/gift.cpp`**

```cpp
void gift::addoper(name account, int64_t daily_quota_bytes)
{
   require_auth(get_self());
   check(is_account(account), "operator account does not exist");
   check(daily_quota_bytes > 0, "quota must be positive");

   operators_table operators(get_self(), get_self().value);
   check(operators.find(account.value) == operators.end(), "operator already registered");

   operators.emplace(get_self(), [&](auto& row) {
      row.account           = account;
      row.daily_quota_bytes = daily_quota_bytes;
      row.used_bytes        = 0;
      row.window_start      = time_point_sec(current_time_point());
   });
}

void gift::rmoper(name account)
{
   require_auth(get_self());
   operators_table operators(get_self(), get_self().value);
   auto            itr = operators.require_find(account.value, "operator not registered");
   operators.erase(itr);
}

void gift::setquota(name account, int64_t daily_quota_bytes)
{
   require_auth(get_self());
   check(daily_quota_bytes > 0, "quota must be positive");
   operators_table operators(get_self(), get_self().value);
   auto            itr = operators.require_find(account.value, "operator not registered");
   operators.modify(itr, same_payer, [&](auto& row) { row.daily_quota_bytes = daily_quota_bytes; });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `make test/gift`
Expected: all `operator admin` tests PASS.

- [ ] **Step 6: Checks and commit**

```bash
make cppcheck jscheck
git add contracts/gift/src/gift.cpp test/gift
git commit -m "Add gift operator registry admin actions"
```

---

### Task 4: giftacct with quota enforcement and inline giftram (TDD)

**Files:**
- Create: `test/gift/giftacct.test.ts`
- Modify: `contracts/gift/src/gift.cpp` (replace `giftacct` stub)

**Interfaces:**
- Consumes: `setup.ts` exports from Task 3; mock `giftedram` table from Task 2; `advanceTime(seconds)` from `test/helpers.ts`.
- Produces: final `giftacct(name op, name to, int64_t bytes, string memo)` behavior relied on by the Task 5 codegen and Task 6 testnet scripts.

- [ ] **Step 1: Write failing tests `test/gift/giftacct.test.ts`**

```ts
import {beforeEach, describe, expect, test} from 'bun:test'
import {Name} from '@wharfkit/antelope'

import {advanceTime, blockchain} from '../helpers'
import {alice, bob, contracts, getOperator, giftContract, newuser, resetContracts} from './setup'

function getGiftedRam(account: string) {
    return contracts.system.tables
        .giftedram(Name.from('eosio').value.value)
        .getTableRow(Name.from(account).value.value)
}

describe('contract: gift - giftacct', () => {
    beforeEach(async () => {
        await resetContracts()
        await contracts.gift.actions.addoper([alice, 10000]).send()
    })

    test('gifts RAM via inline eosio::giftram and debits the quota', async () => {
        await contracts.gift.actions.giftacct([alice, newuser, 4000, 'welcome']).send(alice)
        const row = getGiftedRam(newuser)
        expect(row).toBeDefined()
        expect(row.gifter).toBe(giftContract)
        expect(Number(row.ram_bytes)).toBe(4000)
        expect(Number(getOperator(alice).used_bytes)).toBe(4000)
    })

    test('requires the operator authority', async () => {
        await expect(
            contracts.gift.actions.giftacct([alice, newuser, 4000, '']).send(bob)
        ).rejects.toThrow('missing required authority')
    })

    test('rejects an unregistered operator', async () => {
        await expect(
            contracts.gift.actions.giftacct([bob, newuser, 4000, '']).send(bob)
        ).rejects.toThrow('operator not registered')
    })

    test('rejects non-positive bytes', async () => {
        await expect(
            contracts.gift.actions.giftacct([alice, newuser, 0, '']).send(alice)
        ).rejects.toThrow('must gift positive bytes')
    })

    test('rejects a gift to a nonexistent account', async () => {
        await expect(
            contracts.gift.actions.giftacct([alice, 'missing', 4000, '']).send(alice)
        ).rejects.toThrow('account does not exist')
    })

    test('accumulates usage within the window and enforces the quota', async () => {
        await contracts.gift.actions.giftacct([alice, newuser, 6000, '']).send(alice)
        await contracts.gift.actions.giftacct([alice, newuser, 4000, '']).send(alice)
        expect(Number(getOperator(alice).used_bytes)).toBe(10000)
        await expect(
            contracts.gift.actions.giftacct([alice, newuser, 1, '']).send(alice)
        ).rejects.toThrow('daily quota exceeded')
    })

    test('rejects a single gift larger than the quota', async () => {
        await expect(
            contracts.gift.actions.giftacct([alice, newuser, 10001, '']).send(alice)
        ).rejects.toThrow('daily quota exceeded')
    })

    test('resets the window after 24 hours', async () => {
        await contracts.gift.actions.giftacct([alice, newuser, 10000, '']).send(alice)
        advanceTime(86401)
        await contracts.gift.actions.giftacct([alice, newuser, 4000, '']).send(alice)
        expect(Number(getOperator(alice).used_bytes)).toBe(4000)
    })

    test('does not reset the window before 24 hours', async () => {
        await contracts.gift.actions.giftacct([alice, newuser, 10000, '']).send(alice)
        advanceTime(86000)
        await expect(
            contracts.gift.actions.giftacct([alice, newuser, 1, '']).send(alice)
        ).rejects.toThrow('daily quota exceeded')
    })

    test('single-gifter constraint propagates from the system contract', async () => {
        await contracts.system.actions.giftram([bob, newuser, 100, '']).send(bob)
        await expect(
            contracts.gift.actions.giftacct([alice, newuser, 4000, '']).send(alice)
        ).rejects.toThrow('A single RAM gifter is allowed')
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test/gift`
Expected: FAIL — `giftacct` stub performs no registry check, no quota, no inline action.

- [ ] **Step 3: Implement `giftacct` in `contracts/gift/src/gift.cpp`**

```cpp
void gift::giftacct(name op, name to, int64_t bytes, string memo)
{
   require_auth(op);
   check(bytes > 0, "must gift positive bytes");
   check(is_account(to), "to=" + to.to_string() + " account does not exist");

   operators_table operators(get_self(), get_self().value);
   auto            itr = operators.require_find(op.value, "operator not registered");

   auto           now          = time_point_sec(current_time_point());
   int64_t        used         = itr->used_bytes;
   time_point_sec window_start = itr->window_start;
   if (now.sec_since_epoch() >= window_start.sec_since_epoch() + QUOTA_WINDOW_SECONDS) {
      used         = 0;
      window_start = now;
   }
   check(used + bytes <= itr->daily_quota_bytes, "daily quota exceeded");

   operators.modify(itr, same_payer, [&](auto& row) {
      row.used_bytes   = used + bytes;
      row.window_start = window_start;
   });

   eosiosystem::system_contract::giftram_action giftram{SYSTEM_CONTRACT, {{get_self(), "active"_n}}};
   giftram.send(get_self(), to, bytes, memo);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `make test/gift`
Expected: all `giftacct` tests PASS.

- [ ] **Step 5: Full suite, checks, commit**

```bash
make test
make cppcheck jscheck
git add contracts/gift/src/gift.cpp test/gift/giftacct.test.ts
git commit -m "Add giftacct with quota enforcement and inline giftram"
```

---

### Task 5: Codegen output

**Files:**
- Create (generated): `codegen/gift.ts`

**Interfaces:**
- Produces: `Contract` class in `codegen/gift.ts` (wharfkit-generated) used by Task 6's testnet scripts as `import {Contract as GiftContract} from '../codegen/gift'`.

- [ ] **Step 1: Generate and verify**

Run: `make codegen` (the `./codegen/gift.ts` rule was added in Task 1)
Expected: `codegen/gift.ts` exists and exports `Contract` with `giftacct`, `addoper`, `rmoper`, `setquota` actions.

Run: `make jscheck`
Expected: clean (codegen output is not linted by the `test` glob, but confirm no new eslint errors).

- [ ] **Step 2: Commit** — check whether `codegen/` output is gitignored (`git check-ignore codegen/gift.ts`); if ignored, skip the commit; otherwise:

```bash
git add codegen/gift.ts
git commit -m "Add gift contract codegen"
```

---

### Task 6: Jungle 4 deployment and single-signature demo

**Files:**
- Create: `testnet/gift-setup.ts`, `testnet/gift-demo.ts`
- Modify: root `Makefile` (two phony targets)

**Interfaces:**
- Consumes: `client`, `chain`, `walletPlugin`, `transact` from `testnet/common.ts` (note: importing `common.ts` requires `TESTNET_PRIVATE_KEY` set and defines sessions for other contracts — import only what's needed via a direct import of those symbols; they have no side effects beyond the env check). `Contract` from `codegen/gift.ts` (Task 5).
- Produces: a reproducible on-chain demo — transaction links proving `newaccount` + `giftacct` in one transaction with one signature, and a failed `sellram` proving sequestration.

> [!warning] Manual gate — before this task, the user must:
> 1. Create `gift.gm` on Jungle 4 (requires `gm` authority, since it's a premium name) with the testnet key from `TESTNET_PRIVATE_KEY` on owner/active.
> 2. Fund `gift.gm` with faucet EOS (≥100 EOS) for the RAM endowment: https://monitor4.jungletestnet.io/
> 3. Export `TESTNET_PRIVATE_KEY` and `TESTNET_PUBLIC_KEY` (the key's public form) in the shell.
>
> Stop and ask the user to confirm these before proceeding.

- [ ] **Step 1: Deploy the contract**

Run: `make testnet/gift`
Expected: cleos `set contract` succeeds against `https://jungle4.greymass.com` (account `gift.gm`).

- [ ] **Step 2: Write `testnet/gift-setup.ts`**

One-time setup: add `eosio.code` to `gift.gm@active`, buy the RAM endowment, register the operator.

```ts
import {Action} from '@wharfkit/antelope'
import {Chains, Session} from '@wharfkit/session'

import {Contract as GiftContract} from '../codegen/gift'
import {client, transact, walletPlugin} from './common'

if (!process.env.TESTNET_PUBLIC_KEY) {
    throw new Error('TESTNET_PUBLIC_KEY environment variable is not set')
}

const giftAccount = process.env.GIFT_TESTNET_ACCOUNT!
const operatorAccount = process.env.TESTNET_TEST_ACCOUNT!

const giftSession = new Session({
    chain: Chains.Jungle4,
    actor: giftAccount,
    permission: 'active',
    walletPlugin,
})

const giftContract = new GiftContract({account: giftAccount, client})

const {abi} = await client.v1.chain.get_abi('eosio')

// active keeps its key and gains gift.gm@eosio.code so the contract can send inline giftram
await transact(
    giftSession,
    Action.from(
        {
            account: 'eosio',
            name: 'updateauth',
            authorization: [{actor: giftAccount, permission: 'active'}],
            data: {
                account: giftAccount,
                permission: 'active',
                parent: 'owner',
                auth: {
                    threshold: 1,
                    keys: [{key: process.env.TESTNET_PUBLIC_KEY, weight: 1}],
                    accounts: [
                        {permission: {actor: giftAccount, permission: 'eosio.code'}, weight: 1},
                    ],
                    waits: [],
                },
            },
        },
        abi
    ),
    `Add \`${giftAccount}@eosio.code\` to the active permission.`
)

await transact(
    giftSession,
    Action.from(
        {
            account: 'eosio',
            name: 'buyrambytes',
            authorization: [{actor: giftAccount, permission: 'active'}],
            data: {payer: giftAccount, receiver: giftAccount, bytes: 5000000},
        },
        abi
    ),
    'Buy a 5 MB RAM endowment for the prototype.'
)

await transact(
    giftSession,
    giftContract.action('addoper', {account: operatorAccount, daily_quota_bytes: 1000000}),
    `Register \`${operatorAccount}\` as an operator with a 1 MB daily quota.`
)
```

- [ ] **Step 3: Run setup**

Run: `bun run testnet/gift-setup.ts`
Expected: three transaction links printed, all successful. Verify: `cleos -u https://jungle4.greymass.com get account gift.gm` shows `eosio.code` under active; `get table gift.gm gift.gm operators` shows the operator row.

- [ ] **Step 4: Write `testnet/gift-demo.ts`**

The demo: one transaction, one signature (the operator's), two actions — then a sequestration proof.

```ts
import {Action, KeyType, Name, PrivateKey} from '@wharfkit/antelope'
import {Chains, Session} from '@wharfkit/session'
import {WalletPluginPrivateKey} from '@wharfkit/wallet-plugin-privatekey'

import {Contract as GiftContract} from '../codegen/gift'
import {client, walletPlugin} from './common'

const giftAccount = process.env.GIFT_TESTNET_ACCOUNT!
const operatorAccount = process.env.TESTNET_TEST_ACCOUNT!
const giftContract = new GiftContract({account: giftAccount, client})

const operatorSession = new Session({
    chain: Chains.Jungle4,
    actor: operatorAccount,
    permission: 'active',
    walletPlugin,
})

// random 12-char name and a fresh key for the demo account
const alphabet = 'abcdefghijklmnopqrstuvwxyz12345'
let suffix = ''
for (let i = 0; i < 8; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)]
const newAccount = `demo${suffix}`
const newKey = PrivateKey.generate(KeyType.K1)
const auth = {
    threshold: 1,
    keys: [{key: newKey.toPublic(), weight: 1}],
    accounts: [],
    waits: [],
}

const {abi} = await client.v1.chain.get_abi('eosio')

console.log(`Creating ${newAccount} — one transaction, one signature (${operatorAccount})`)

const result = await operatorSession.transact({
    actions: [
        Action.from(
            {
                account: 'eosio',
                name: 'newaccount',
                authorization: [{actor: operatorAccount, permission: 'active'}],
                data: {creator: operatorAccount, name: newAccount, owner: auth, active: auth},
            },
            abi
        ),
        giftContract.action(
            'giftacct',
            {op: operatorAccount, to: newAccount, bytes: 4000, memo: 'gifted account demo'},
            {authorization: [{actor: operatorAccount, permission: 'active'}]}
        ),
    ],
})
if (!result.resolved) throw new Error('Transaction failed')
console.log(
    `Created: https://jungle4.unicove.com/transaction/${result.resolved.transaction.id}`
)

await new Promise((resolve) => setTimeout(resolve, 1500))

// proof 1: the gift is recorded against the system contract
const gifted = await client.v1.chain.get_table_rows({
    code: 'eosio',
    scope: 'eosio',
    table: 'giftedram',
    lower_bound: Name.from(newAccount),
    upper_bound: Name.from(newAccount),
    json: true,
})
console.log('giftedram row:', JSON.stringify(gifted.rows[0]))

// proof 2: the new account cannot sell the gifted RAM
const newSession = new Session({
    chain: Chains.Jungle4,
    actor: newAccount,
    permission: 'active',
    walletPlugin: new WalletPluginPrivateKey(newKey),
})
try {
    await newSession.transact({
        action: Action.from(
            {
                account: 'eosio',
                name: 'sellram',
                authorization: [{actor: newAccount, permission: 'active'}],
                data: {account: newAccount, bytes: 1000},
            },
            abi
        ),
    })
    console.log('UNEXPECTED: sellram succeeded — gifted RAM was sellable')
    process.exit(1)
} catch (error) {
    console.log(`sellram correctly rejected: ${String(error)}`)
}
```

- [ ] **Step 5: Add Makefile conveniences**

```makefile
.PHONY: testnet/gift/setup
testnet/gift/setup: codegen
	bun run testnet/gift-setup.ts

.PHONY: testnet/gift/demo
testnet/gift/demo: codegen
	bun run testnet/gift-demo.ts
```

- [ ] **Step 6: Run the demo**

Run: `make testnet/gift/demo`
Expected output, in order: a transaction link (the single-signature create+gift), a `giftedram` row showing `gifter: gift.gm` and `ram_bytes: 4000`, and a rejected `sellram` (error mentioning insufficient quota / gifted RAM). Run it twice to confirm quota accumulation on chain: `cleos -u https://jungle4.greymass.com get table gift.gm gift.gm operators` shows `used_bytes` = 8000.

- [ ] **Step 7: Lint and commit**

```bash
make jscheck
git add testnet/gift-setup.ts testnet/gift-demo.ts Makefile
git commit -m "Add gift contract testnet setup and demo scripts"
```

---

## Self-Review Notes

- Spec coverage: registry + quota (Tasks 3–4), inline giftram via eosio.code (Task 4 impl, Task 6 setup), single-signature creation flow (Task 6 demo), sequestration proof (Task 6 demo). Not in prototype scope (per spec, governance-level): MSIG account creation, `admin.grants` seeding, `eosio.wrap` recovery.
- The `op` parameter name is used (not `operator`) because `operator` is a C++ keyword.
- Vert has no resource-limit model at all (the privileged intrinsic `set_resource_limits` is absent from `@vaulta/vert` 2.1.1, along with `set_parameters_packed` and `set_privileged`, which is also why the real `eosio.system` wasm can't be deployed as `eosio` in Task 2), so real RAM billing — including the end-of-transaction billing that makes `newaccount` + `giftacct` work in one transaction — is unprovable in vert by construction; the end-of-transaction billing claim is validated exclusively by the Jungle 4 demo — that is the point of Task 6.
- `contracts.gift.tables.operators(...)` scope argument: vert table helpers take the scope as a `UInt64` value; `setup.ts`'s `getOperator` passes `Name.from(giftContract).value.value` to match the `test/create` precedent (`getBalance`).
