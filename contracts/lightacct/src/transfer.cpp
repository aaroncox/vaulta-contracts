#pragma once

#include <lightacct/lightacct.hpp>

namespace vaultacontracts {

void lightacct::send(uint64_t from_id, const public_key& to_key, const asset& quantity, const string& memo)
{
   config_row config = get_config();

   validate_auth(config, from_id);

   check(quantity.is_valid(), "invalid quantity");
   check(quantity.amount > 0, "must transfer positive quantity");
   check(memo.size() <= 256, "memo has more than 256 bytes");

   balance_table from_balances(get_self(), from_id);
   auto          from_itr = from_balances.find(quantity.symbol.code().raw());
   check(from_itr != from_balances.end(), "no balance for this token");
   check(from_itr->balance.amount >= quantity.amount, "overdrawn balance");

   from_balances.modify(from_itr, same_payer, [&](auto& row) { row.balance -= quantity; });

   if (from_itr->balance.amount == 0) {
      from_balances.erase(from_itr);
   }

   asset    credit_amount = quantity;
   uint64_t to_id         = find_or_create_account(config, to_key, credit_amount);

   check(credit_amount.amount > 0, "transfer insufficient to cover network fees (RAM)");

   balance_table to_balances(get_self(), to_id);
   auto          to_bal_itr = to_balances.find(credit_amount.symbol.code().raw());

   if (to_bal_itr == to_balances.end()) {
      to_balances.emplace(get_self(), [&](auto& row) { row.balance = credit_amount; });
   } else {
      to_balances.modify(to_bal_itr, same_payer, [&](auto& row) { row.balance += credit_amount; });
   }
}

void lightacct::withdraw(uint64_t credential_id, const name& to_account, const asset& quantity, const string& memo)
{
   config_row config = get_config();

   validate_auth(config, credential_id);

   check(quantity.is_valid(), "invalid quantity");
   check(quantity.amount > 0, "must withdraw positive quantity");
   check(memo.size() <= 256, "memo has more than 256 bytes");
   check(is_account(to_account), "destination account does not exist");

   balance_table balances(get_self(), credential_id);
   auto          itr = balances.find(quantity.symbol.code().raw());
   check(itr != balances.end(), "no balance for this token");
   check(itr->balance.amount >= quantity.amount, "overdrawn balance");

   balances.modify(itr, same_payer, [&](auto& row) { row.balance -= quantity; });

   if (itr->balance.amount == 0) {
      balances.erase(itr);
   }

   action(
      permission_level{get_self(), "active"_n},
      config.token_contract,
      "transfer"_n,
      std::make_tuple(get_self(), to_account, quantity, memo))
      .send();
}

} // namespace vaultacontracts
