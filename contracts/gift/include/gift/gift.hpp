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

   struct [[eosio::table("operators")]] operator_row
   {
      name           account;
      int64_t        daily_quota_bytes;
      int64_t        used_bytes;
      time_point_sec window_start;

      uint64_t primary_key() const { return account.value; }
   };

   typedef eosio::multi_index<"operators"_n, operator_row> operators_table;

   [[eosio::action]] void addoper(name account, int64_t daily_quota_bytes);
   [[eosio::action]] void rmoper(name account);
   [[eosio::action]] void setquota(name account, int64_t daily_quota_bytes);
   [[eosio::action]] void giftacct(name op, name to, int64_t bytes, string memo);

   using addoper_action  = eosio::action_wrapper<"addoper"_n, &gift::addoper>;
   using rmoper_action   = eosio::action_wrapper<"rmoper"_n, &gift::rmoper>;
   using setquota_action = eosio::action_wrapper<"setquota"_n, &gift::setquota>;
   using giftacct_action = eosio::action_wrapper<"giftacct"_n, &gift::giftacct>;

#ifdef DEBUG
   [[eosio::action]] void reset();
#endif
};

} // namespace vaultacontracts
