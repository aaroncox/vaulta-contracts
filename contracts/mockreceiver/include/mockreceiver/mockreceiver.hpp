#pragma once

#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>
#include <tokens/tokens.hpp>

using namespace eosio;

namespace vaultacontracts {

class [[eosio::contract("mockreceiver")]] mockreceiver : public contract
{
public:
   using contract::contract;

   struct [[eosio::table("config")]] config_row
   {
      name tokencontract; // account where token contract to accept tokens from
      name sender;        // account which tokens are accepted from
      name destination;   // account where the tokens are sent to
   };
   typedef eosio::singleton<"config"_n, config_row> config_table;

   [[eosio::action]] void setconfig(const name tokencontract, const name sender, const name destination);
   using setconfig_action = eosio::action_wrapper<"setconfig"_n, &mockreceiver::setconfig>;

   [[eosio::on_notify("*::transfer")]] void
   on_transfer(const name& from, const name& to, const asset& quantity, const string& memo);

#ifdef DEBUG
   [[eosio::action]] void reset();
#endif
};

} // namespace vaultacontracts