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

   [[eosio::action]] void newaccount(name creator, name account);
   [[eosio::action]] void giftram(name from, name to, int64_t bytes, string memo);
   [[eosio::action]] void ungiftram(name from, name to, string memo);
};

} // namespace vaultacontracts
