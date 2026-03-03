#pragma once

#include <lightacct/lightacct.hpp>

namespace vaultacontracts {

void lightacct::init(const name& keyhost, const symbol& core_symbol, const name& token_contract,
                     const name& system_contract)
{
   require_auth(get_self());

   config_table config_singleton(get_self(), get_self().value);
   check(!config_singleton.exists(), "contract already initialized");

   config_singleton.set(
      config_row{
         .keyhost            = keyhost,
         .core_symbol        = core_symbol,
         .token_contract     = token_contract,
         .system_contract    = system_contract,
         .next_credential_id = 3,
      },
      get_self());
}

void lightacct::authkey(const vector<uint64_t>& credential_ids)
{
   config_row config = get_config();

   check(credential_ids.size() > 0, "must provide at least one credential id");

   credential_table credentials(get_self(), get_self().value);

   for (const auto& id : credential_ids) {
      auto itr = credentials.find(id);
      check(itr != credentials.end(), "credential not found");
      require_auth(permission_level{config.keyhost, permission_from_id(id)});
   }
}

lightacct::config_row lightacct::get_config()
{
   config_table config_singleton(get_self(), get_self().value);
   check(config_singleton.exists(), "contract not initialized");
   return config_singleton.get();
}

uint64_t lightacct::next_credential_id(config_table& config_singleton, config_row& config)
{
   uint64_t id = config.next_credential_id;

   while (id == "owner"_n.value || id == "active"_n.value) {
      id++;
   }

   config.next_credential_id = id + 1;
   config_singleton.set(config, get_self());
   return id;
}

void lightacct::validate_auth(const config_row& config, uint64_t credential_id)
{
   auto first_action = get_action(1, 0);
   check(first_action.account == get_self(), "first action must be authkey on this contract");
   check(first_action.name == "authkey"_n, "first action must be authkey");

   auto credential_ids = unpack<vector<uint64_t>>(first_action.data);
   bool found          = false;
   for (const auto& id : credential_ids) {
      if (id == credential_id) {
         found = true;
         break;
      }
   }
   check(found, "credential not authenticated in authkey");
}

} // namespace vaultacontracts
