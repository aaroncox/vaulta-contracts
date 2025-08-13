namespace registry {

template <typename T>
void registry::clear_table(T& table, uint64_t rows_to_clear)
{
   auto itr = table.begin();
   while (itr != table.end() && rows_to_clear--) {
      itr = table.erase(itr);
   }
}

[[eosio::action]] void registry::reset()
{
   config_table _config(get_self(), get_self().value);
   _config.remove();

   token_table tokens(get_self(), get_self().value);
   auto        tokens_itr = tokens.begin();
   while (tokens_itr != tokens.end()) {
      tokens_itr = tokens.erase(tokens_itr);
   }

   contract_table contracts(get_self(), get_self().value);
   auto           contracts_itr = contracts.begin();
   while (contracts_itr != contracts.end()) {
      contracts_itr = contracts.erase(contracts_itr);
   }
}

} // namespace registry