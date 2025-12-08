#include <sentiment/sentiment.hpp>

namespace vaultacontracts {

[[eosio::action]] void sentiment::voteaccount(const name& voter, const name& account, uint8_t vote_type)
{
   require_auth(voter);

   auto config = get_config();
   require_enabled(config);

   check(vote_type == 0 || vote_type == 1, "vote_type must be 0 (opposition) or 1 (support)");
   check(is_account(account), "account does not exist");

   // Votes scoped by the target account
   account_votes_table votes(get_self(), account.value);
   auto                vote_itr = votes.find(voter.value);

   if (vote_itr == votes.end()) {
      // Create new vote
      votes.emplace(voter, [&](auto& row) {
         row.voter     = voter;
         row.account   = account;
         row.vote_type = vote_type;
      });
   } else {
      // Update existing vote
      votes.modify(vote_itr, same_payer, [&](auto& row) { row.vote_type = vote_type; });
   }
}

[[eosio::action]] void sentiment::rmacctvote(const name& voter, const name& account)
{
   require_auth(voter);

   auto config = get_config();
   require_enabled(config);

   check(is_account(account), "account does not exist");

   account_votes_table votes(get_self(), account.value);
   auto                vote_itr = votes.find(voter.value);
   check(vote_itr != votes.end(), "vote does not exist");

   votes.erase(vote_itr);
}

[[eosio::action, eosio::read_only]] sentiment::get_account_vote_response sentiment::getacctvote(const name& voter,
                                                                                                const name& account)
{
   account_votes_table votes(get_self(), account.value);
   auto                vote_itr = votes.find(voter.value);
   check(vote_itr != votes.end(), "vote does not exist");

   return get_account_vote_response{
      .voter = vote_itr->voter, .account = vote_itr->account, .vote_type = vote_itr->vote_type};
}

[[eosio::action, eosio::read_only]] vector<sentiment::get_account_vote_response>
sentiment::getactvtrs(const name& account)
{
   check(is_account(account), "account does not exist");

   account_votes_table                          votes(get_self(), account.value);
   vector<sentiment::get_account_vote_response> results;

   for (auto itr = votes.begin(); itr != votes.end(); ++itr) {
      results.push_back(
         get_account_vote_response{.voter = itr->voter, .account = itr->account, .vote_type = itr->vote_type});
   }

   return results;
}

} // namespace vaultacontracts
