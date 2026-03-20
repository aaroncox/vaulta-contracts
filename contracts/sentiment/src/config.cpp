#include <sentiment/sentiment.hpp>

namespace vaultacontracts {

sentiment::config_row sentiment::get_config()
{
   config_table _config(get_self(), get_self().value);
   return _config.get_or_default();
}

[[eosio::action]] void sentiment::setconfig(const name& system_contract, const name& token_contract,
                                             const name& token_action, const symbol& token_symbol,
                                             const name& fee_receiver, const asset& createtopic_fee)
{
   require_auth(get_self());
   config_table _config(get_self(), get_self().value);
   auto         config         = _config.get_or_default();
   config.system_contract     = system_contract;
   config.fees.token.contract = token_contract;
   config.fees.token.symbol   = token_symbol;
   config.fees.action         = token_action;
   config.fees.receiver       = fee_receiver;
   config.fees.createtopic    = createtopic_fee;
   _config.set(config, get_self());
}

[[eosio::action]] void sentiment::enable()
{
   require_auth(get_self());
   config_table _config(get_self(), get_self().value);
   auto         config = _config.get_or_default();
   check(config.fees.token.symbol.is_valid(), "fees.token symbol must be set");
   check(config.fees.token.contract.value != 0, "fees.token contract must be set");
   check(config.fees.receiver.value != 0, "fees receiver must be set");
   check(config.fees.createtopic.amount > 0, "fees createtopic must be greater than 0");
   config.enabled = true;
   _config.set(config, get_self());
}

[[eosio::action]] void sentiment::disable()
{
   require_auth(get_self());
   config_table _config(get_self(), get_self().value);
   auto         config = _config.get_or_default();
   config.enabled      = false;
   _config.set(config, get_self());
}

} // namespace vaultacontracts
