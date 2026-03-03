#pragma once

#include <lightacct/lightacct.hpp>

#include <eosio.system/eosio.system.hpp>

using namespace std;
using namespace eosiosystem;

#include <antelope/publickey.hpp>
#include <antelope/publickey.cpp>

namespace vaultacontracts {

static asset ram_cost_with_fee(uint32_t bytes, symbol core_symbol)
{
   rammarket _rammarket("eosio"_n, "eosio"_n.value);
   auto      itr = _rammarket.find(system_contract::ramcore_symbol.raw());

   const int64_t ram_reserve = itr->base.balance.amount;
   const int64_t eos_reserve = itr->quote.balance.amount;

   int64_t cost = (eos_reserve * bytes) / (ram_reserve - bytes);
   if (cost < 0)
      cost = 0;

   asset cost_asset{cost, core_symbol};
   asset fee = cost_asset;
   fee.amount = (fee.amount + 199) / 200;

   return cost_asset + fee;
}

static public_key parse_public_key(const string& memo)
{
   if (memo.substr(0, 3) == "EOS") {
      return antelope::stringToLegacyPublicKey(memo);
   }
   if (memo.substr(0, 4) == "PUB_") {
      return antelope::stringToPublicKey(memo);
   }
   check(false, "memo must be a public key (EOS... or PUB_K1_... or PUB_R1_...)");
   __builtin_unreachable();
}

void lightacct::on_transfer(const name& from, const name& to, const asset& quantity, const string& memo)
{
   if (to != get_self())
      return;

   if (from == get_self())
      return;

   config_row config = get_config();

   if (get_first_receiver() != config.token_contract) {
      check(from == config.system_contract, "deposits only accepted from configured token contract");
      return;
   }
   check(quantity.symbol == config.core_symbol, "deposits only accepted in configured token symbol");
   check(quantity.is_valid(), "invalid quantity");
   check(quantity.amount > 0, "must deposit positive quantity");
   check(memo.size() > 0, "memo must contain the recipient public key");

   public_key recipient_key = parse_public_key(memo);
   asset      credit_amount = quantity;

   uint64_t account_id = find_or_create_account(config, recipient_key, credit_amount);

   check(credit_amount.amount > 0, "deposit insufficient to cover network fees (RAM)");

   balance_table balances(get_self(), account_id);
   auto          bal_itr = balances.find(credit_amount.symbol.code().raw());

   if (bal_itr == balances.end()) {
      balances.emplace(get_self(), [&](auto& row) { row.balance = credit_amount; });
   } else {
      balances.modify(bal_itr, same_payer, [&](auto& row) { row.balance += credit_amount; });
   }
}

uint64_t lightacct::find_or_create_account(config_row& config, const public_key& key, asset& credit_amount)
{
   credential_table credentials(get_self(), get_self().value);
   checksum256      kh      = hash_key(key);
   auto             key_idx = credentials.get_index<"bykeyhash"_n>();
   auto             itr     = key_idx.find(kh);

   if (itr != key_idx.end()) {
      return itr->id;
   }

   config_table config_singleton(get_self(), get_self().value);
   uint64_t     id = next_credential_id(config_singleton, config);

   uint32_t keyhost_bytes = 338;
   uint32_t contract_bytes = 586;
   asset    ram_cost = ram_cost_with_fee(keyhost_bytes + contract_bytes, config.core_symbol);

   credit_amount -= ram_cost;

   credentials.emplace(get_self(), [&](auto& row) {
      row.id       = id;
      row.key      = key;
      row.key_hash = kh;
   });

   eosiosystem::authority auth;
   auth.threshold = 1;
   auth.keys.push_back({key, 1});

   action(
      permission_level{config.keyhost, "active"_n},
      "eosio"_n,
      "updateauth"_n,
      std::make_tuple(config.keyhost, permission_from_id(id), "active"_n, auth))
      .send();

   system_contract::buyrambytes_action buyrambytes{config.system_contract, {get_self(), "active"_n}};
   buyrambytes.send(get_self(), config.keyhost, keyhost_bytes);
   buyrambytes.send(get_self(), get_self(), contract_bytes);

   return id;
}

} // namespace vaultacontracts
