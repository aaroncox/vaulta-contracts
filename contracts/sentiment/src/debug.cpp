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

   // config_table _config(get_self(), get_self().value);
   // _config.remove();

   // Clear all votes for all topics
   topics_table topics(get_self(), get_self().value);
   for (auto topic_itr = topics.begin(); topic_itr != topics.end(); ++topic_itr) {
      votes_table votes(get_self(), topic_itr->id.value);
      clear_table(votes, -1);
   }

   // Clear all topics
   clear_table(topics, -1);
}

} // namespace vaultacontracts