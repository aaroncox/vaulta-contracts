#include <sentiment/sentiment.hpp>

namespace vaultacontracts {

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

} // namespace vaultacontracts
