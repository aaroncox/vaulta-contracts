#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>
#include <eosio/transaction.hpp>

#include <eosio.system/native.hpp>

using namespace eosio;

namespace vaultacontracts {

using std::string;
using std::vector;

class [[eosio::contract("lightacct")]] lightacct : public contract
{
public:
   using contract::contract;

   [[eosio::action]]
   void init(const name& keyhost, const symbol& core_symbol, const name& token_contract,
             const name& system_contract);

   [[eosio::action]]
   void authkey(const vector<uint64_t>& credential_ids);

   [[eosio::action]]
   void send(uint64_t from_id, const public_key& to_key, const asset& quantity, const string& memo);

   [[eosio::action]]
   void withdraw(uint64_t credential_id, const name& to_account, const asset& quantity, const string& memo);

   [[eosio::on_notify("*::transfer")]]
   void on_transfer(const name& from, const name& to, const asset& quantity, const string& memo);

   struct [[eosio::table("config")]] config_row
   {
      name     keyhost;
      symbol   core_symbol;
      name     token_contract;
      name     system_contract;
      uint64_t next_credential_id = 3;
   };
   typedef eosio::singleton<"config"_n, config_row> config_table;

   struct [[eosio::table]] credential
   {
      uint64_t    id;
      public_key  key;
      checksum256 key_hash;

      uint64_t    primary_key() const { return id; }
      checksum256 by_key_hash() const { return key_hash; }
   };

   typedef eosio::multi_index<
      "credentials"_n,
      credential,
      eosio::indexed_by<"bykeyhash"_n, eosio::const_mem_fun<credential, checksum256, &credential::by_key_hash>>>
      credential_table;

   struct [[eosio::table]] balance
   {
      asset balance;

      uint64_t primary_key() const { return balance.symbol.code().raw(); }
   };

   typedef eosio::multi_index<"balances"_n, balance> balance_table;

   static checksum256 hash_key(const public_key& key)
   {
      auto packed = pack(key);
      return sha256(packed.data(), packed.size());
   }

   static name permission_from_id(uint64_t id) { return name(id); }

#ifdef DEBUG
   [[eosio::action]] void reset();
#endif

private:
   config_row get_config();
   uint64_t   next_credential_id(config_table& config_singleton, config_row& config);
   void       validate_auth(const config_row& config, uint64_t credential_id);
   uint64_t   find_or_create_account(config_row& config, const public_key& key, asset& credit_amount);

#ifdef DEBUG
   template <typename T>
   void clear_table(T& table, uint64_t rows_to_clear);
#endif
};

} // namespace vaultacontracts
