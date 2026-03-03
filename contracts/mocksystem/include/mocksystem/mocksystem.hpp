#pragma once

#include <eosio/asset.hpp>
#include <eosio/binary_extension.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/ignore.hpp>

#include <eosio.system/exchange_state.hpp>
#include <eosio.system/native.hpp>

using namespace eosio;

class [[eosio::contract("mocksystem")]] mocksystem : public contract {
  public:
   using contract::contract;

   [[eosio::action]]
   void buyrambytes(const name& payer, const name& receiver, uint32_t bytes) {}

   [[eosio::action]]
   void newaccount(const name& creator,
                   const name& newact,
                   ignore<eosiosystem::authority> owner,
                   ignore<eosiosystem::authority> active) {}

   [[eosio::action]]
   void updateauth(name account,
                   name permission,
                   name parent,
                   eosiosystem::authority auth,
                   binary_extension<name> authorized_by) {}

   struct [[eosio::table("rammarket")]] rammarket_row : eosiosystem::exchange_state {
      using exchange_state::exchange_state;
   };

   typedef multi_index<"rammarket"_n, rammarket_row> rammarket_table;
};
