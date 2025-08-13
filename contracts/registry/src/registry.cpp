#include <registry/registry.hpp>

namespace registry {

registry::config_row registry::get_config()
{
   config_table _config(get_self(), get_self().value);
   return _config.get_or_default();
}

bool registry::is_enabled() { return get_config().enabled; }

void registry::add_token(const name rampayer, const name contract, const symbol symbol)
{
   token_table tokens(get_self(), get_self().value);
   tokens.emplace(rampayer, [&](auto& row) {
      row.id       = tokens.available_primary_key();
      row.contract = contract;
      row.symbol   = symbol;
   });
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

[[eosio::action]] void registry::regtoken(const name&                      contract,
                                          const name&                      issuer,
                                          const asset&                     supply,
                                          const std::vector<distribution>& distribution,
                                          const asset&                     payment)
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
      check(payment.symbol == fee_config.token.symbol, "incorrect payment symbol");
      check(payment.amount == fee_config.regtoken.amount, "incorrect payment amount");

      // Transfer fee payment to receiver
      token::transfer_action transfer_act{fee_config.token.contract,
                                          {{issuer, eosiosystem::system_contract::active_permission}}};
      transfer_act.send(issuer, fee_config.receiver, payment,
                        std::string("regtoken payment for ") + supply.symbol.code().to_string());
   }

   // TODO: Call token creation on the defined contract

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

[[eosio::action]] void registry::setconfig(const bool enabled, const optional<fees> fees)
{
   require_auth(get_self());
   config_table _config(get_self(), get_self().value);
   auto         config = _config.get_or_default();
   config.enabled      = enabled;
   if (fees.has_value()) {
      config.fees = fees.value();
   }
   _config.set(config, get_self());
}

} // namespace registry

#ifdef DEBUG
#include "debug.cpp"
#endif
