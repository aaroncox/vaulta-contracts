#include <sentiment/sentiment.hpp>

namespace vaultacontracts {

struct token_account_row
{
   asset    balance;
   uint64_t primary_key() const { return balance.symbol.code().raw(); }
};
typedef eosio::multi_index<"accounts"_n, token_account_row> token_accounts_table;

struct vaulta_account_row
{
   asset    balance;
   bool     released = false;
   uint64_t primary_key() const { return balance.symbol.code().raw(); }
   EOSLIB_SERIALIZE(vaulta_account_row, (balance)(released))
};
typedef eosio::multi_index<"accounts"_n, vaulta_account_row> vaulta_accounts_table;

struct rms_stake_row
{
   name     account;
   uint64_t amount           = 0;
   uint64_t unstaking_amount = 0;
   uint64_t primary_key() const { return account.value; }
};
typedef eosio::multi_index<"stake"_n, rms_stake_row> rms_stake_table;

sentiment::get_voter_weight_response sentiment::get_voter_weight(const config_row& config, const name& voter)
{
   check(is_account(voter), "voter account does not exist");

   // Query the voters table from the system contract
   eosiosystem::voters_table voters_table(config.system_contract, config.system_contract.value);
   auto                      voter_itr = voters_table.find(voter.value);

   int64_t weight = 0;
   if (voter_itr != voters_table.end()) {
      weight = voter_itr->staked;
   }

   return get_voter_weight_response{.voter = voter, .weight = weight};
}

[[eosio::action, eosio::read_only]] sentiment::get_voter_weight_response sentiment::getweight(const name& voter)
{
   auto config = get_config();
   return get_voter_weight(config, voter);
}

[[eosio::action, eosio::read_only]] vector<sentiment::get_voter_weight_response>
sentiment::getweights(const vector<name>& voters)
{
   auto                                         config = get_config();
   vector<sentiment::get_voter_weight_response> results;

   for (const auto& voter : voters) {
      results.push_back(get_voter_weight(config, voter));
   }

   return results;
}

sentiment::rex_pool_state sentiment::get_rex_pool(const config_row& config)
{
   eosiosystem::rex_pool_table pool(config.system_contract, config.system_contract.value);
   auto                        itr = pool.begin();
   if (itr == pool.end()) {
      return rex_pool_state{};
   }
   return rex_pool_state{.total_lendable = itr->total_lendable.amount, .total_rex = itr->total_rex.amount};
}

sentiment::get_voter_metrics_response
sentiment::get_voter_metrics(const config_row& config, const rex_pool_state& pool, const name& voter)
{
   check(is_account(voter), "voter account does not exist");

   int64_t system_staked = 0;
   eosiosystem::del_bandwidth_table delband(config.system_contract, voter.value);
   auto d = delband.find(voter.value);
   if (d != delband.end()) {
      system_staked += d->net_weight.amount + d->cpu_weight.amount;
   }
   eosiosystem::rex_balance_table rexbal(config.system_contract, config.system_contract.value);
   auto r = rexbal.find(voter.value);
   if (r != rexbal.end() && pool.total_rex > 0) {
      // live REX valuation, the system's own formula (rex.cpp update_rex_stake)
      system_staked += int64_t((int128_t(r->rex_balance.amount) * pool.total_lendable) / pool.total_rex);
   }

   int64_t system_liquid = 0;
   vaulta_accounts_table va(config.metrics.system_token.contract, voter.value);
   auto a = va.find(config.metrics.system_token.symbol.code().raw());
   if (a != va.end()) {
      system_liquid += a->balance.amount;
   }
   token_accounts_table ea(config.metrics.legacy_token.contract, voter.value);
   auto e = ea.find(config.metrics.legacy_token.symbol.code().raw());
   if (e != ea.end()) {
      system_liquid += e->balance.amount;
   }

   int64_t ram_bytes = 0;
   eosiosystem::user_resources_table userres(config.system_contract, voter.value);
   auto u = userres.find(voter.value);
   if (u != userres.end()) {
      ram_bytes += u->ram_bytes;
   }
   token_accounts_table wa(config.metrics.wram_token.contract, voter.value);
   auto w = wa.find(config.metrics.wram_token.symbol.code().raw());
   if (w != wa.end()) {
      ram_bytes += w->balance.amount;
   }

   int64_t v_staked = 0;
   rms_stake_table stk(config.metrics.v_stake_contract, config.metrics.v_stake_contract.value);
   auto s = stk.find(voter.value);
   if (s != stk.end()) {
      v_staked = int64_t(s->amount + s->unstaking_amount);
   }
   int64_t v_liquid = 0;
   token_accounts_table vt(config.metrics.v_token.contract, voter.value);
   auto v = vt.find(config.metrics.v_token.symbol.code().raw());
   if (v != vt.end()) {
      v_liquid = v->balance.amount;
   }

   return get_voter_metrics_response{
      .voter         = voter,
      .system_staked = system_staked,
      .system_liquid = system_liquid,
      .ram_bytes     = ram_bytes,
      .v_staked      = v_staked,
      .v_liquid      = v_liquid,
   };
}

[[eosio::action, eosio::read_only]] sentiment::get_voter_metrics_response sentiment::getmetric(const name& voter)
{
   auto config = get_config();
   auto pool   = get_rex_pool(config);
   return get_voter_metrics(config, pool, voter);
}

[[eosio::action, eosio::read_only]] vector<sentiment::get_voter_metrics_response>
sentiment::getmetrics(const vector<name>& voters)
{
   auto config = get_config();
   auto pool   = get_rex_pool(config);
   vector<sentiment::get_voter_metrics_response> results;
   for (const auto& voter : voters) {
      results.push_back(get_voter_metrics(config, pool, voter));
   }
   return results;
}

} // namespace vaultacontracts
