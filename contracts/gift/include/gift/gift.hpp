#pragma once

#include <eosio.system/eosio.system.hpp>
#include <eosio/eosio.hpp>

using namespace eosio;
using namespace std;

namespace vaultacontracts {

class [[eosio::contract("gift")]] gift : public contract
{
public:
   using contract::contract;

   static constexpr name     SYSTEM_CONTRACT      = "eosio"_n;
   static constexpr uint32_t QUOTA_WINDOW_SECONDS = 86400;
   static constexpr int64_t  GIFT_ROW_OVERHEAD    = 136;

   struct [[eosio::table("creators")]] creator_row
   {
      name           creator;
      int64_t        daily_quota_bytes;
      int64_t        used_bytes;
      time_point_sec window_start;

      uint64_t primary_key() const { return creator.value; }
   };

   typedef eosio::multi_index<"creators"_n, creator_row> creators_table;

   [[eosio::action]] void addcreator(name creator, int64_t daily_quota_bytes);
   [[eosio::action]] void rmcreator(name creator);
   [[eosio::action]] void setquota(name creator, int64_t daily_quota_bytes);
   [[eosio::action]] void giftacct(name creator, name account, int64_t bytes, string memo);

   using addcreator_action = eosio::action_wrapper<"addcreator"_n, &gift::addcreator>;
   using rmcreator_action  = eosio::action_wrapper<"rmcreator"_n, &gift::rmcreator>;
   using setquota_action   = eosio::action_wrapper<"setquota"_n, &gift::setquota>;
   using giftacct_action   = eosio::action_wrapper<"giftacct"_n, &gift::giftacct>;

#ifdef DEBUG
   [[eosio::action]] void reset();
#endif
};

} // namespace vaultacontracts
