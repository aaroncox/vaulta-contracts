#include <sentiment/sentiment.hpp>

namespace vaultacontracts {

struct legacy_config_row
{
   bool                       enabled         = false;
   name                       system_contract = "eosio"_n;
   sentiment::fees_config     fees;
   EOSLIB_SERIALIZE(legacy_config_row, (enabled)(system_contract)(fees))
};

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

[[eosio::action]] void sentiment::setmetriccfg(const metrics_config& metrics)
{
   require_auth(get_self());
   config_table _config(get_self(), get_self().value);
   auto         config = _config.get_or_default();
   config.metrics      = metrics;
   _config.set(config, get_self());
}

[[eosio::action]] void sentiment::migrate()
{
   require_auth(get_self());
   const uint64_t table = "config"_n.value;
   auto itr = internal_use_do_not_use::db_find_i64(get_self().value, get_self().value, table, table);
   check(itr >= 0, "no config row to migrate");
   auto              size = internal_use_do_not_use::db_get_i64(itr, nullptr, 0);
   std::vector<char> data(size);
   internal_use_do_not_use::db_get_i64(itr, data.data(), size);
   legacy_config_row old = eosio::unpack<legacy_config_row>(data.data(), data.size());
   check(eosio::pack(old).size() == data.size(), "config already migrated");
   // remove raw row so singleton set() never deserializes the old bytes
   internal_use_do_not_use::db_remove_i64(itr);
   config_row fresh;
   fresh.enabled         = old.enabled;
   fresh.system_contract = old.system_contract;
   fresh.fees            = old.fees;
   config_table _config(get_self(), get_self().value);
   _config.set(fresh, get_self());
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
