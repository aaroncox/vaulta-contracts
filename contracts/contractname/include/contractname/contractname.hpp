#pragma once

#include <eosio/contract.hpp>
#include <eosio/singleton.hpp>

using namespace eosio;
using namespace std;

namespace contractname {

class [[eosio::contract("contractname")]] contractname : public contract
{
public:
   using contract::contract;

   /**
    * Example Action
    */
   [[eosio::action]] void foo(const string bar);
   using foo_action = action_wrapper<"foo"_n, &contractname::foo>;

#ifdef DEBUG // DEBUG (only used on dev builds for testnet)
   [[eosio::action]] void
   cleartable(const name table_name, const optional<name> scope, const optional<uint64_t> max_rows);
   [[eosio::action]] void wipe();
#endif

private:
#ifdef DEBUG // DEBUG (only used on dev builds for testnet)
   // @debug
   template <typename T>
   void clear_table(T& table, uint64_t rows_to_clear);
#endif
};

} // namespace contractname
