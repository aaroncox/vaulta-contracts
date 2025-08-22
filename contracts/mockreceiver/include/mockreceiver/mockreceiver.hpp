#pragma once

#include <eosio/eosio.hpp>

using namespace eosio;

namespace mockreceiver {

class [[eosio::contract("mockreceiver")]] mockreceiver : public contract
{
public:
   using contract::contract;

#ifdef DEBUG
   [[eosio::action]] void reset();
#endif

private:
#ifdef DEBUG
   template <typename T>
   void clear_table(T& table, uint64_t rows_to_clear);
#endif
};

} // namespace mockreceiver