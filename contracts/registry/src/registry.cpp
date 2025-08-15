#include <registry/registry.hpp>

namespace registry {

registry::config_row registry::get_config()
{
   config_table _config(get_self(), get_self().value);
   return _config.get_or_default();
}

bool registry::is_enabled() { return get_config().enabled; }

void registry::add_balance(const name account, const asset quantity)
{
   balance_table balances(get_self(), get_self().value);
   auto          balance_itr = balances.find(account.value);
   if (balance_itr != balances.end()) {
      balances.modify(balance_itr, same_payer, [&](auto& b) { b.balance += quantity; });
   } else {
      balances.emplace(get_self(), [&](auto& b) {
         b.account = account;
         b.balance = quantity;
      });
   }
}

void registry::add_token(const name rampayer, const name contract, const symbol symbol)
{
   token_table tokens(get_self(), get_self().value);
   tokens.emplace(rampayer, [&](auto& row) {
      row.id       = tokens.available_primary_key();
      row.contract = contract;
      row.symbol   = symbol;
   });
}

asset registry::get_balance(const name account, const config_row config)
{
   balance_table balances(get_self(), get_self().value);
   auto          balance_itr = balances.find(account.value);
   if (balance_itr != balances.end()) {
      return balance_itr->balance;
   } else {
      return asset(0, config.systemtoken.symbol);
   }
}

void registry::remove_balance(const name account, const asset quantity)
{
   balance_table balances(get_self(), get_self().value);
   auto          balance_itr = balances.find(account.value);
   check(balance_itr != balances.end(), "no contract balance for account");
   check(balance_itr->balance.amount >= quantity.amount, "insufficient contract balance");

   if (balance_itr->balance.amount == quantity.amount) {
      balances.erase(balance_itr);
   } else {
      balances.modify(balance_itr, same_payer, [&](auto& b) { b.balance -= quantity; });
   }
}

void registry::remove_token(const uint64_t id)
{
   token_table tokens(get_self(), get_self().value);
   auto&       token = tokens.get(id, "token not found");
   tokens.erase(token);
}

void registry::add_token_contract(const name contract)
{
   contract_table contracts(get_self(), get_self().value);
   contracts.emplace(get_self(), [&](auto& row) { row.account = contract; });
}

void registry::remove_token_contract(const name contract)
{
   contract_table contracts(get_self(), get_self().value);
   auto           itr = contracts.find(contract.value);
   check(itr != contracts.end(), "contract not found");
   contracts.erase(itr);
}

[[eosio::on_notify("*::transfer")]] void
registry::on_transfer(const name from, const name to, const asset quantity, const string memo)
{
   // ignore RAM sales
   // ignore transfers not sent to this contract
   if (from == "eosio.ram"_n || to != get_self()) {
      return;
   }

   // ignore transfers sent from this contract to purchase RAM
   // otherwise revert transaction if sending EOS outside of this contract if RAM transfer is enabled
   if (from == get_self()) {
      if (to == "eosio.ram"_n || to == "eosio.ramfee"_n) {
         return;
      }
      return;
   }

   auto config = get_config();
   require_enabled(config);

   check(get_first_receiver() == config.systemtoken.contract, "Incorrect token contract for deposit.");
   check(quantity.symbol == config.systemtoken.symbol, "Incorrect token symbol for deposit.");

   add_balance(from, quantity);
}

[[eosio::action]] void registry::withdraw(const name account, const asset quantity)
{
   require_auth(account);

   auto config = get_config();
   require_enabled(config);

   check(quantity.symbol == config.systemtoken.symbol, "Incorrect token symbol for withdraw.");

   remove_balance(account, quantity);

   // Send the tokens
   token::transfer_action transfer_act{config.systemtoken.contract,
                                       {{get_self(), eosiosystem::system_contract::active_permission}}};
   transfer_act.send(get_self(), account, quantity, "");
}

[[eosio::action]] void registry::regtoken(const name&                                    contract,
                                          const name&                                    issuer,
                                          const asset&                                   supply,
                                          const std::vector<antelope::token_allocation>& allocations,
                                          const asset&                                   payment)
{
   require_auth(issuer);
   auto config = get_config();
   require_enabled(config);

   // Verify that the contract is whitelisted
   contract_table contracts(get_self(), get_self().value);
   auto           contract_itr = contracts.find(contract.value);
   check(contract_itr != contracts.end(), "contract is not whitelisted");

   if (config.fees.has_value()) {
      const auto& fee_config = config.fees.value();

      // Verify payment values
      check(payment.symbol == config.systemtoken.symbol, "incorrect payment symbol");
      check(payment.amount == fee_config.regtoken.amount, "incorrect payment amount");

      // Verify contract balance to pay fee
      asset contract_balance = get_balance(issuer, config);
      check(contract_balance.amount >= payment.amount, "insufficient contract balance to pay registration fee");

      // Remove fee from contract balance
      remove_balance(issuer, payment);

      // Transfer fee to receiver
      token::transfer_action transfer_act{config.systemtoken.contract,
                                          {{get_self(), eosiosystem::system_contract::active_permission}}};
      transfer_act.send(get_self(), fee_config.receiver, payment, "token registration fee");
   }

   // Validate allocations
   antelope::check_allocations(supply, allocations);

   // Notify the token contract of the new token registration
   require_recipient(contract);

   // Add the token to the registry
   add_token(issuer, contract, supply.symbol);
}

[[eosio::action]] void registry::addtoken(const name contract, const symbol symbol)
{
   require_auth(get_self());
   token_table tokens(get_self(), get_self().value);
   auto        tokendef_index = tokens.get_index<"tokendef"_n>();
   auto        token_itr      = tokendef_index.find(((uint128_t)contract.value << 64) | symbol.raw());
   check(token_itr == tokendef_index.end(), "token is already registered");
   add_token(get_self(), contract, symbol);
}

[[eosio::action]] void registry::addcontract(const name contract)
{
   require_auth(get_self());
   contract_table contracts(get_self(), get_self().value);
   auto           itr = contracts.find(contract.value);
   check(itr == contracts.end(), "contract is already registered");
   add_token_contract(contract);
}

[[eosio::action]] void registry::rmtoken(const uint64_t id)
{
   require_auth(get_self());
   remove_token(id);
}

[[eosio::action]] void registry::rmcontract(const name contract)
{
   require_auth(get_self());
   remove_token_contract(contract);
}

[[eosio::action]] void
registry::setconfig(const bool enabled, const antelope::token_definition systemtoken, const optional<fees> fees)
{
   require_auth(get_self());
   config_table _config(get_self(), get_self().value);
   auto         config = _config.get_or_default();
   config.enabled      = enabled;
   config.systemtoken  = systemtoken;
   if (fees.has_value()) {
      config.fees = fees.value();
   }
   _config.set(config, get_self());
}

} // namespace registry

#ifdef DEBUG
#include "debug.cpp"
#endif
