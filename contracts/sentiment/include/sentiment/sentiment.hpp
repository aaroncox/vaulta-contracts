#pragma once

#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>
#include <eosio/system.hpp>

#include <string>
#include <vector>

using namespace eosio;

namespace vaultacontracts {

using std::string;
using std::vector;

class [[eosio::contract("sentiment")]] sentiment : public contract
{
public:
   using contract::contract;

   /** Table Definitions */
   struct [[eosio::table("config")]] config_row
   {
      // Whether or not the contract is enabled
      bool enabled = false;
   };
   typedef eosio::singleton<"config"_n, config_row> config_table;

   struct [[eosio::table]] topic_row
   {
      name   id;
      string description;

      uint64_t primary_key() const { return id.value; }
   };
   typedef eosio::multi_index<"topics"_n, topic_row> topics_table;

   struct [[eosio::table]] vote_row
   {
      name    voter;
      name    topic_id;
      uint8_t vote_type; // 0 = opposition, 1 = support

      uint64_t primary_key() const { return voter.value; }
      uint64_t by_topic() const { return topic_id.value; }
   };
   typedef eosio::
      multi_index<"votes"_n, vote_row, indexed_by<"bytopic"_n, const_mem_fun<vote_row, uint64_t, &vote_row::by_topic>>>
         votes_table;

   /** Response Structures */
   struct get_topic_response
   {
      name   id;
      string description;
   };

   struct get_vote_response
   {
      name    voter;
      name    topic_id;
      uint8_t vote_type;
   };

   /** Contract State Management */
   [[eosio::action]] void enable();
   using enable_action = eosio::action_wrapper<"enable"_n, &sentiment::enable>;

   [[eosio::action]] void disable();
   using disable_action = eosio::action_wrapper<"disable"_n, &sentiment::disable>;

   [[eosio::action]] void setconfig(const config_row& config);
   using setconfig_action = eosio::action_wrapper<"setconfig"_n, &sentiment::setconfig>;

   /** Topic Management */
   [[eosio::action]] void createtopic(const name& id, const string& description);
   using createtopic_action = eosio::action_wrapper<"createtopic"_n, &sentiment::createtopic>;

   [[eosio::action]] void updatetopic(const name& id, const string& description);
   using updatetopic_action = eosio::action_wrapper<"updatetopic"_n, &sentiment::updatetopic>;

   [[eosio::action]] void deletetopic(const name& id);
   using deletetopic_action = eosio::action_wrapper<"deletetopic"_n, &sentiment::deletetopic>;

   /** Voting Actions */
   [[eosio::action]] void vote(const name& voter, const name& topic_id, uint8_t vote_type);
   using vote_action = eosio::action_wrapper<"vote"_n, &sentiment::vote>;

   [[eosio::action]] void changevote(const name& voter, const name& topic_id, uint8_t vote_type);
   using changevote_action = eosio::action_wrapper<"changevote"_n, &sentiment::changevote>;

   [[eosio::action]] void removevote(const name& voter, const name& topic_id);
   using removevote_action = eosio::action_wrapper<"removevote"_n, &sentiment::removevote>;

   /** Administrative Actions */
   [[eosio::action]] void bulkrmvotes(const name& topic_id, uint32_t num_votes);
   using bulkrmvotes_action = eosio::action_wrapper<"bulkrmvotes"_n, &sentiment::bulkrmvotes>;

   /** Read-Only Actions */
   [[eosio::action, eosio::read_only]] get_topic_response gettopic(const name& id);
   using gettopic_action = eosio::action_wrapper<"gettopic"_n, &sentiment::gettopic>;

   [[eosio::action, eosio::read_only]] vector<get_topic_response> gettopics();
   using gettopics_action = eosio::action_wrapper<"gettopics"_n, &sentiment::gettopics>;

   [[eosio::action, eosio::read_only]] get_vote_response getvote(const name& voter, const name& topic_id);
   using getvote_action = eosio::action_wrapper<"getvote"_n, &sentiment::getvote>;

   [[eosio::action, eosio::read_only]] vector<get_vote_response> getvoters(const name& topic_id);
   using getvoters_action = eosio::action_wrapper<"getvoters"_n, &sentiment::getvoters>;

#ifdef DEBUG
   [[eosio::action]] void reset();
#endif

private:
   config_row get_config();
   void       require_enabled(const config_row& config) { check(config.enabled, "contract is disabled"); }

#ifdef DEBUG
   template <typename T>
   void clear_table(T& table, uint64_t rows_to_clear);
#endif
};

} // namespace vaultacontracts
