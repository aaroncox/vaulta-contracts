#include <gift/gift.hpp>

#include <eosio/transaction.hpp>

namespace vaultacontracts {

static bool created_in_transaction(name account)
{
   auto              size = eosio::transaction_size();
   std::vector<char> buffer(size);
   check(eosio::read_transaction(buffer.data(), size) == size, "failed to read transaction");
   auto trx = eosio::unpack<eosio::transaction>(buffer.data(), size);
   for (const auto& act : trx.actions) {
      if (act.account != gift::SYSTEM_CONTRACT || act.name != "newaccount"_n) {
         continue;
      }
      datastream<const char*> ds(act.data.data(), act.data.size());
      name                    creator;
      name                    created;
      ds >> creator >> created;
      if (created == account) {
         return true;
      }
   }
   return false;
}

void gift::addoper(name account, int64_t daily_quota_bytes)
{
   require_auth(get_self());
   check(is_account(account), "operator account does not exist");
   check(daily_quota_bytes > 0, "quota must be positive");

   operators_table operators(get_self(), get_self().value);
   check(operators.find(account.value) == operators.end(), "operator already registered");

   operators.emplace(get_self(), [&](auto& row) {
      row.account           = account;
      row.daily_quota_bytes = daily_quota_bytes;
      row.used_bytes        = 0;
      row.window_start      = time_point_sec(current_time_point());
   });
}

void gift::rmoper(name account)
{
   require_auth(get_self());
   operators_table operators(get_self(), get_self().value);
   auto            itr = operators.require_find(account.value, "operator not registered");
   operators.erase(itr);
}

void gift::setquota(name account, int64_t daily_quota_bytes)
{
   require_auth(get_self());
   check(daily_quota_bytes > 0, "quota must be positive");
   operators_table operators(get_self(), get_self().value);
   auto            itr = operators.require_find(account.value, "operator not registered");
   operators.modify(itr, same_payer, [&](auto& row) { row.daily_quota_bytes = daily_quota_bytes; });
}

void gift::giftacct(name op, name to, int64_t bytes, string memo)
{
   require_auth(op);
   check(bytes > 0, "must gift positive bytes");
   check(is_account(to), "to account does not exist");
   check(memo.size() <= 256, "memo has more than 256 bytes");

   operators_table operators(get_self(), get_self().value);
   auto            itr = operators.require_find(op.value, "operator not registered");

   auto           now          = time_point_sec(current_time_point());
   int64_t        used         = itr->used_bytes;
   time_point_sec window_start = itr->window_start;
   if (now.sec_since_epoch() >= window_start.sec_since_epoch() + QUOTA_WINDOW_SECONDS) {
      used         = 0;
      window_start = now;
   }
   int64_t remaining = itr->daily_quota_bytes - used;
   check(remaining >= GIFT_ROW_OVERHEAD && bytes <= remaining - GIFT_ROW_OVERHEAD, "daily quota exceeded");

   check(created_in_transaction(to), "to must be created by eosio::newaccount in the same transaction");

   operators.modify(itr, same_payer, [&](auto& row) {
      row.used_bytes   = used + bytes + GIFT_ROW_OVERHEAD;
      row.window_start = window_start;
   });

   eosiosystem::system_contract::giftram_action giftram{SYSTEM_CONTRACT, {{get_self(), "active"_n}}};
   giftram.send(get_self(), to, bytes, memo);
}

} // namespace vaultacontracts

#ifdef DEBUG
#include "debug.cpp"
#endif
