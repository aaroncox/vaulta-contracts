#pragma once

#include <eosio.system/eosio.system.hpp>
#include <eosio.token/eosio.token.hpp>
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>

#include <antelope/antelope.hpp>

#include <string>

// namespace eosiosystem {
// class system_contract;
// }

using namespace eosio;

namespace registry {

using std::string;

class [[eosio::contract("registry")]] registry : public contract
{
public:
   using contract::contract;

   struct fees
   {
      // The token accepted for payment
      antelope::token_definition token;

      // The account that receives the fees
      name receiver;

      // Fees for individual actions
      asset regtoken;
   };

   struct distribution
   {
      name  receiver;
      asset quantity;
   };

   struct [[eosio::table("config")]] config_row
   {
      bool           enabled = false;
      optional<fees> fees;
   };
   typedef eosio::singleton<"config"_n, config_row> config_table;

   struct [[eosio::table("contracts")]] contract_row
   {
      name     account;
      uint64_t primary_key() const { return account.value; }
   };
   typedef eosio::multi_index<"contracts"_n, contract_row> contract_table;

   struct [[eosio::table("tokens")]] token_row
   {
      uint64_t  id = uint64_t(-1);
      name      contract;
      symbol    symbol;
      uint64_t  primary_key() const { return id; }
      uint128_t by_tokendef() const { return ((uint128_t)contract.value << 64) | symbol.raw(); }
   };
   typedef eosio::multi_index<
      "tokens"_n,
      token_row,
      eosio::indexed_by<"tokendef"_n, eosio::const_mem_fun<token_row, uint128_t, &token_row::by_tokendef>>>
      token_table;

   [[eosio::action]] void setconfig(const bool enabled, const optional<fees> fees);
   using setconfig_action = eosio::action_wrapper<"setconfig"_n, &registry::setconfig>;

   [[eosio::action]] void regtoken(const name&                      contract,
                                   const name&                      issuer,
                                   const asset&                     supply,
                                   const std::vector<distribution>& distribution,
                                   const asset&                     fee);
   using regtoken_action = eosio::action_wrapper<"regtoken"_n, &registry::regtoken>;

   [[eosio::action]] void addcontract(const name contract);
   using addcontract_action = eosio::action_wrapper<"addcontract"_n, &registry::addcontract>;

   [[eosio::action]] void addtoken(const name contract, const symbol symbol);
   using addtoken_action = eosio::action_wrapper<"addtoken"_n, &registry::addtoken>;

   [[eosio::action]] void rmcontract(const name contract);
   using rmcontract_action = eosio::action_wrapper<"rmcontract"_n, &registry::rmcontract>;

   [[eosio::action]] void rmtoken(const uint64_t id);
   using rmtoken_action = eosio::action_wrapper<"rmtoken"_n, &registry::rmtoken>;

#ifdef DEBUG
   [[eosio::action]] void reset();
#endif

private:
   config_row get_config();
   bool       is_enabled();
   void       require_enabled(const config_row& config) { check(config.enabled, "contract is disabled"); }
   void       add_token(const name issuer, const name contract, const symbol symbol);
   void       add_token_contract(const name contract);
   token_row  get_token(const name contract, const symbol symbol);
   void       remove_token(const uint64_t id);
   void       remove_token_contract(const name contract);

#ifdef DEBUG
   template <typename T>
   void clear_table(T& table, uint64_t rows_to_clear);
#endif
};

} // namespace registry