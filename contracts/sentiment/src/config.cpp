#include <sentiment/sentiment.hpp>

namespace vaultacontracts {

sentiment::config_row sentiment::get_config()
{
   config_table _config(get_self(), get_self().value);
   return _config.get_or_default();
}

[[eosio::action]] void sentiment::setconfig(const config_row& config)
{
   require_auth(get_self());
   config_table _config(get_self(), get_self().value);
   _config.set(config, get_self());
}

[[eosio::action]] void sentiment::enable()
{
   require_auth(get_self());
   config_table _config(get_self(), get_self().value);
   auto         config = _config.get_or_default();
   config.enabled      = true;
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
