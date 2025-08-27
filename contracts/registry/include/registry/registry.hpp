#pragma once

#include <eosio.system/eosio.system.hpp>
#include <eosio.token/eosio.token.hpp>
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>

#include <antelope/antelope.hpp>

#include <string>

using namespace eosio;

namespace vaultacontracts {

using std::string;

class [[eosio::contract("registry")]] registry : public contract
{
public:
   using contract::contract;

   struct fees_config
   {
      // The token definition for fees/deposits/withdrawals
      antelope::token_definition token;

      // The account that receives any fees paid
      name receiver;

      // Fee for registering a token in the registry
      asset regtoken;
   };

   struct regtoken_config
   {
      // Minimum length for token tickers
      uint8_t minlength = 1;
   };

   struct [[eosio::table("config")]] config_row
   {
      // Whether or not the contract is enabled
      bool enabled = false;

      // The fee configuration
      fees_config fees;

      // The configuration of regtoken
      regtoken_config regtoken;
   };
   typedef eosio::singleton<"config"_n, config_row> config_table;

   struct [[eosio::table("balance")]] balance_row
   {
      name     account;
      asset    balance;
      uint64_t primary_key() const { return account.value; }
   };
   typedef eosio::multi_index<"balance"_n, balance_row> balance_table;

   struct [[eosio::table("contracts")]] contract_row
   {
      name     account;
      uint64_t primary_key() const { return account.value; }
   };
   typedef eosio::multi_index<"contracts"_n, contract_row> contract_table;

   struct [[eosio::table("tokens")]] token_row
   {
      symbol_code    ticker;
      uint8_t        precision;
      name           creator;
      optional<name> contract;
      uint64_t       primary_key() const { return ticker.raw(); }
   };
   typedef eosio::multi_index<"tokens"_n, token_row> token_table;

   /** Registry State Management */
   [[eosio::action]] void enable();
   using enable_action = eosio::action_wrapper<"enable"_n, &registry::enable>;

   [[eosio::action]] void disable();
   using disable_action = eosio::action_wrapper<"disable"_n, &registry::disable>;

   [[eosio::action]] void setconfig(const config_row& config);
   using setconfig_action = eosio::action_wrapper<"setconfig"_n, &registry::setconfig>;

   /** Balance Management */
   [[eosio::on_notify("*::transfer")]] void
   on_transfer(const name& from, const name& to, const asset& quantity, const string& memo);

   [[eosio::action]] void withdraw(const name& account, const asset& quantity);
   using withdraw_action = eosio::action_wrapper<"withdraw"_n, &registry::withdraw>;

   [[eosio::action]] void openbalance(const name& account);
   using openbalance_action = eosio::action_wrapper<"openbalance"_n, &registry::openbalance>;

   [[eosio::action]] void closebalance(const name& account);
   using closebalance_action = eosio::action_wrapper<"closebalance"_n, &registry::closebalance>;

   /** Token Registration */
   [[eosio::action]] void
   regtoken(const name& creator, const symbol_code& ticker, const uint8_t& precision, const asset& payment);
   using regtoken_action = eosio::action_wrapper<"regtoken"_n, &registry::regtoken>;

   [[eosio::action]] void setcontract(const symbol_code& ticker, const name& contract);
   using setcontract_action = eosio::action_wrapper<"setcontract"_n, &registry::setcontract>;

   /** Token Registry Admin */
   [[eosio::action]] void addcontract(const name& contract);
   using addcontract_action = eosio::action_wrapper<"addcontract"_n, &registry::addcontract>;

   [[eosio::action]] void addtoken(const name& creator, const symbol_code& ticker, const uint8_t& precision);
   using addtoken_action = eosio::action_wrapper<"addtoken"_n, &registry::addtoken>;

   [[eosio::action]] void rmcontract(const name& contract);
   using rmcontract_action = eosio::action_wrapper<"rmcontract"_n, &registry::rmcontract>;

   [[eosio::action]] void rmtoken(const symbol_code& ticker);
   using rmtoken_action = eosio::action_wrapper<"rmtoken"_n, &registry::rmtoken>;

#ifdef DEBUG
   [[eosio::action]] void reset();
#endif

private:
   config_row get_config();
   bool       is_enabled();
   void       require_enabled(const config_row& config) { check(config.enabled, "contract is disabled"); }

   /** Deposit System Management */
   void  add_balance(const name& account, const asset& quantity);
   asset get_balance(const name& account, const symbol& token_symbol);
   void  open_balance(const name& account);
   void  close_balance(const name& account);
   void  remove_balance(const name& account, const asset& quantity);

   /** Token Registry Admin */
   void add_token(const symbol_code& ticker, const uint8_t& precision, const name& creator, const name& rampayer);
   void add_token_contract(const name& contract);
   void remove_token(const symbol_code& ticker);
   void remove_token_contract(const name& contract);
   // void      add_allocation(const name contract, const name receiver, const asset quantity, const name rampayer);

#ifdef DEBUG
   template <typename T>
   void clear_table(T& table, uint64_t rows_to_clear);
#endif
};

} // namespace vaultacontracts