namespace vaultacontracts {

template <typename T>
void sentiment::clear_table(T& table, uint64_t rows_to_clear)
{
   auto itr = table.begin();
   while (itr != table.end() && rows_to_clear--) {
      itr = table.erase(itr);
   }
}

[[eosio::action]] void sentiment::reset()
{
   require_auth(get_self());

   config_table _config(get_self(), get_self().value);
   _config.remove();

   balance_table balances(get_self(), get_self().value);
   clear_table(balances, -1);

   // Clear all votes for all topics
   topics_table topics(get_self(), get_self().value);
   for (auto topic_itr = topics.begin(); topic_itr != topics.end(); ++topic_itr) {
      votes_table votes(get_self(), topic_itr->id.value);
      clear_table(votes, -1);
   }

   // Clear all topics
   clear_table(topics, -1);

   // Clear all account votes for test accounts
   vector<name> test_accounts = {"alice"_n, "bob"_n, "charlie"_n};
   for (const auto& account : test_accounts) {
      account_votes_table votes(get_self(), account.value);
      clear_table(votes, -1);
   }

   // Clear msig votes for common test proposals
   // Msig votes are scoped by the proposal (subject being voted on)
   vector<name> test_proposers = {"alice"_n, "bob"_n, "charlie"_n};
   vector<name> test_proposals = {"testprop"_n, "test"_n, "proposal"_n};

   for (const auto& proposer : test_proposers) {
      for (const auto& proposal : test_proposals) {
         // Compute scope the same way as get_proposal_scope()
         uint128_t        combined = ((uint128_t)proposer.value << 64) | proposal.value;
         uint64_t         scope    = static_cast<uint64_t>(combined >> 64) ^ static_cast<uint64_t>(combined);
         msig_votes_table votes(get_self(), scope);
         clear_table(votes, -1);
      }
   }
}

} // namespace vaultacontracts
