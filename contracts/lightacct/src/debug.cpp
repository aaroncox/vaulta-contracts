#pragma once

#include <lightacct/lightacct.hpp>

namespace vaultacontracts {

void lightacct::reset()
{
   require_auth(get_self());

   credential_table credentials(get_self(), get_self().value);
   for (auto itr = credentials.begin(); itr != credentials.end(); itr++) {
      balance_table balances(get_self(), itr->id);
      clear_table(balances, -1);
   }
   clear_table(credentials, -1);

   config_table config_singleton(get_self(), get_self().value);
   if (config_singleton.exists()) {
      config_singleton.remove();
   }
}

template <typename T>
void lightacct::clear_table(T& table, uint64_t rows_to_clear)
{
   auto itr = table.begin();
   while (itr != table.end() && rows_to_clear--) {
      itr = table.erase(itr);
   }
}

} // namespace vaultacontracts
