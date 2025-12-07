#include <sentiment/sentiment.hpp>

namespace vaultacontracts {

// Helper function to compute scope for msig votes from proposer + proposal_name
// The scope represents the subject being voted on (the proposal)
static uint64_t get_proposal_scope(const name& proposer, const name& proposal_name)
{
   // Combine proposer and proposal_name into uint128, then hash to uint64 for scope
   uint128_t combined = ((uint128_t)proposer.value << 64) | proposal_name.value;
   // XOR upper and lower 64 bits to create unique scope
   return static_cast<uint64_t>(combined >> 64) ^ static_cast<uint64_t>(combined);
}

[[eosio::action]] void
sentiment::votemsig(const name& voter, const name& proposer, const name& proposal_name, uint8_t vote_type)
{
   require_auth(voter);

   auto config = get_config();
   require_enabled(config);

   check(vote_type == 0 || vote_type == 1, "vote_type must be 0 (opposition) or 1 (support)");

   // Validate proposal exists in eosio.msig contract
   eosio::multisig::proposals proposals("eosio.msig"_n, proposer.value);
   auto                       prop_itr = proposals.find(proposal_name.value);
   check(prop_itr != proposals.end(), "proposal does not exist");

   // Scope by the proposal (subject being voted on)
   uint64_t         scope = get_proposal_scope(proposer, proposal_name);
   msig_votes_table votes(get_self(), scope);
   auto             vote_itr = votes.find(voter.value);

   if (vote_itr == votes.end()) {
      // Create new vote
      votes.emplace(voter, [&](auto& row) {
         row.voter         = voter;
         row.proposer      = proposer;
         row.proposal_name = proposal_name;
         row.vote_type     = vote_type;
      });
   } else {
      // Update existing vote (upsert behavior)
      votes.modify(vote_itr, same_payer, [&](auto& row) { row.vote_type = vote_type; });
   }
}

[[eosio::action]] void sentiment::rmmsigvote(const name& voter, const name& proposer, const name& proposal_name)
{
   require_auth(voter);

   auto config = get_config();
   require_enabled(config);

   // Validate proposal exists
   eosio::multisig::proposals proposals("eosio.msig"_n, proposer.value);
   auto                       prop_itr = proposals.find(proposal_name.value);
   check(prop_itr != proposals.end(), "proposal does not exist");

   uint64_t         scope = get_proposal_scope(proposer, proposal_name);
   msig_votes_table votes(get_self(), scope);
   auto             vote_itr = votes.find(voter.value);
   check(vote_itr != votes.end(), "vote does not exist");

   votes.erase(vote_itr);
}

[[eosio::action, eosio::read_only]] sentiment::get_msig_vote_response
sentiment::getmsigvote(const name& voter, const name& proposer, const name& proposal_name)
{
   // Validate proposal exists
   eosio::multisig::proposals proposals("eosio.msig"_n, proposer.value);
   auto                       prop_itr = proposals.find(proposal_name.value);
   check(prop_itr != proposals.end(), "proposal does not exist");

   uint64_t         scope = get_proposal_scope(proposer, proposal_name);
   msig_votes_table votes(get_self(), scope);
   auto             vote_itr = votes.find(voter.value);
   check(vote_itr != votes.end(), "vote does not exist");

   return get_msig_vote_response{.voter         = vote_itr->voter,
                                 .proposer      = vote_itr->proposer,
                                 .proposal_name = vote_itr->proposal_name,
                                 .vote_type     = vote_itr->vote_type};
}

[[eosio::action, eosio::read_only]] vector<sentiment::get_msig_vote_response>
sentiment::getmsigvtrs(const name& proposer, const name& proposal_name)
{
   // Validate proposal exists
   eosio::multisig::proposals proposals("eosio.msig"_n, proposer.value);
   auto                       prop_itr = proposals.find(proposal_name.value);
   check(prop_itr != proposals.end(), "proposal does not exist");

   uint64_t                                  scope = get_proposal_scope(proposer, proposal_name);
   msig_votes_table                          votes(get_self(), scope);
   vector<sentiment::get_msig_vote_response> results;

   // All votes in this scope are for this proposal
   for (auto itr = votes.begin(); itr != votes.end(); ++itr) {
      results.push_back(get_msig_vote_response{.voter         = itr->voter,
                                               .proposer      = itr->proposer,
                                               .proposal_name = itr->proposal_name,
                                               .vote_type     = itr->vote_type});
   }

   return results;
}

} // namespace vaultacontracts
