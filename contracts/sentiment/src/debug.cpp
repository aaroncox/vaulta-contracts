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

   topics_table topics(get_self(), get_self().value);
   clear_table(topics, -1);
}

} // namespace vaultacontracts