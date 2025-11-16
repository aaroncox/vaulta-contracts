#include <sentiment/sentiment.hpp>

namespace vaultacontracts {

[[eosio::action]] void sentiment::createtopic(const name& id, const string& description)
{
   require_auth(get_self());

   topics_table topics(get_self(), get_self().value);

   auto itr = topics.find(id.value);
   check(itr == topics.end(), "Topic with this ID already exists");

   topics.emplace(get_self(), [&](auto& row) {
      row.id          = id;
      row.description = description;
   });
}

[[eosio::action]] void sentiment::deletetopic(const name& id)
{
   require_auth(get_self());

   topics_table topics(get_self(), get_self().value);

   auto itr = topics.find(id.value);
   check(itr != topics.end(), "Topic does not exist");

   topics.erase(itr);
}

} // namespace vaultacontracts

#ifdef DEBUG
#include "debug.cpp"
#endif
