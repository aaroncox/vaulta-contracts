#pragma once

#include <eosio/eosio.hpp>

#include <string>

using namespace eosio;

namespace vaultacontracts {

using std::string;

class [[eosio::contract("sentiment")]] sentiment : public contract
{
public:
   using contract::contract;

   /** Table Definitions */
   struct [[eosio::table]] topic
   {
      name   id;
      string description;

      uint64_t primary_key() const { return id.value; }
   };
   typedef eosio::multi_index<"topics"_n, topic> topics_table;

   /** Topic Management */
   [[eosio::action]] void createtopic(const name& id, const string& description);
   using createtopic_action = eosio::action_wrapper<"createtopic"_n, &sentiment::createtopic>;

   [[eosio::action]] void deletetopic(const name& id);
   using deletetopic_action = eosio::action_wrapper<"deletetopic"_n, &sentiment::deletetopic>;

#ifdef DEBUG
   [[eosio::action]] void reset();
#endif

private:
#ifdef DEBUG
   template <typename T>
   void clear_table(T& table, uint64_t rows_to_clear);
#endif
};

} // namespace vaultacontracts
