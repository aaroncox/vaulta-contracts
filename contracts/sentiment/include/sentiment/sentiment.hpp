#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>
#include <eosio/system.hpp>

#include <eosio.msig/eosio.msig.hpp>
#include <eosio.system/eosio.system.hpp>
#include <eosio.token/eosio.token.hpp>

#include <antelope/antelope.hpp>

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

   struct fees_config
   {
      antelope::token_definition token;
      name                       receiver;
      asset                      createtopic;
      name                       action = "transfer"_n;
   };

   /** Table Definitions */
   struct [[eosio::table("config")]] config_row
   {
      bool        enabled         = false;
      name        system_contract = "eosio"_n;
      fees_config fees;
   };
   typedef eosio::singleton<"config"_n, config_row> config_table;

   struct [[eosio::table("balance")]] balance_row
   {
      name     account;
      asset    balance;
      uint64_t primary_key() const { return account.value; }
   };
   typedef eosio::multi_index<"balance"_n, balance_row> balance_table;

   struct [[eosio::table]] topic_row
   {
      name   id;
      string description;
      name creator;

      uint64_t primary_key() const { return id.value; }
   };
   typedef eosio::multi_index<"topics"_n, topic_row> topics_table;

   struct [[eosio::table]] topic_vote_row
   {
      name    voter;
      name    topic_id;
      uint8_t vote_type; // 0 = opposition, 1 = support

      uint64_t primary_key() const { return voter.value; }
   };
   // Table scoped by topic_id (the subject being voted on)
   typedef eosio::multi_index<"votes"_n, topic_vote_row> votes_table;

   struct [[eosio::table]] account_vote_row
   {
      name    voter;
      name    account;   // The account being voted on
      uint8_t vote_type; // 0 = opposition, 1 = support

      uint64_t primary_key() const { return voter.value; }
   };
   // Table scoped by account (the subject being voted on)
   typedef eosio::multi_index<"accountvotes"_n, account_vote_row> account_votes_table;

   struct [[eosio::table]] msig_vote_row
   {
      name    voter;
      name    proposer;      // Account that proposed the msig
      name    proposal_name; // Name of the proposal
      uint8_t vote_type;     // 0 = opposition, 1 = support

      uint64_t primary_key() const { return voter.value; }
   };
   // Table scoped by composite of proposer+proposal_name (the subject being voted on)
   // No secondary index needed since scope already isolates by proposal
   typedef eosio::multi_index<"msigvotes"_n, msig_vote_row> msig_votes_table;

   /** Response Structures */
   struct get_topic_response
   {
      name   id;
      string description;
      name   creator;
   };

   struct get_topic_vote_response
   {
      name    voter;
      name    topic_id;
      uint8_t vote_type;
   };

   struct get_voter_weight_response
   {
      name    voter;
      int64_t weight;
   };

   struct get_account_vote_response
   {
      name    voter;
      name    account;
      uint8_t vote_type;
   };

   struct get_msig_vote_response
   {
      name    voter;
      name    proposer;
      name    proposal_name;
      uint8_t vote_type;
   };

   /** Contract State Management */
   [[eosio::action]] void enable();
   using enable_action = eosio::action_wrapper<"enable"_n, &sentiment::enable>;

   [[eosio::action]] void disable();
   using disable_action = eosio::action_wrapper<"disable"_n, &sentiment::disable>;

   [[eosio::action]] void setconfig(const name& system_contract, const name& token_contract, const name& token_action,
                                    const symbol& token_symbol, const name& fee_receiver, const asset& createtopic_fee);
   using setconfig_action = eosio::action_wrapper<"setconfig"_n, &sentiment::setconfig>;

   /** Topic Management */
   [[eosio::action]] void createtopic(const name& creator, const name& id, const string& description, const asset& payment);
   using createtopic_action = eosio::action_wrapper<"createtopic"_n, &sentiment::createtopic>;

   [[eosio::action]] void updatetopic(const name& id, const string& description);
   using updatetopic_action = eosio::action_wrapper<"updatetopic"_n, &sentiment::updatetopic>;

   [[eosio::action]] void deletetopic(const name& id);
   using deletetopic_action = eosio::action_wrapper<"deletetopic"_n, &sentiment::deletetopic>;

   /** Balance Management */
   [[eosio::on_notify("*::transfer")]] void
   on_transfer(const name& from, const name& to, const asset& quantity, const string& memo);

   [[eosio::action]] void open(const name& account);
   using open_action = eosio::action_wrapper<"open"_n, &sentiment::open>;

   [[eosio::action]] void withdraw(const name& account, const asset& quantity);
   using withdraw_action = eosio::action_wrapper<"withdraw"_n, &sentiment::withdraw>;

   /** Voting Actions */
   [[eosio::action]] void votetopic(const name& voter, const name& topic_id, uint8_t vote_type);
   using votetopic_action = eosio::action_wrapper<"votetopic"_n, &sentiment::votetopic>;

   // DEPRECATED: Use votetopic() instead. Kept for backwards compatibility, may be removed in future.
   [[eosio::action]] void vote(const name& voter, const name& topic_id, uint8_t vote_type);
   using vote_action = eosio::action_wrapper<"vote"_n, &sentiment::vote>;

   // DEPRECATED: Use votetopic() instead. Kept for backwards compatibility, may be removed in future.
   [[eosio::action]] void changevote(const name& voter, const name& topic_id, uint8_t vote_type);
   using changevote_action = eosio::action_wrapper<"changevote"_n, &sentiment::changevote>;

   [[eosio::action]] void rmtopicvote(const name& voter, const name& topic_id);
   using rmtopicvote_action = eosio::action_wrapper<"rmtopicvote"_n, &sentiment::rmtopicvote>;

   // DEPRECATED: Use rmtopicvote() instead. Kept for backwards compatibility, may be removed in future.
   [[eosio::action]] void removevote(const name& voter, const name& topic_id);
   using removevote_action = eosio::action_wrapper<"removevote"_n, &sentiment::removevote>;

   /** Administrative Actions */
   [[eosio::action]] void bulkrmvotes(const name& topic_id, uint32_t num_votes);
   using bulkrmvotes_action = eosio::action_wrapper<"bulkrmvotes"_n, &sentiment::bulkrmvotes>;

   /** Account Voting Actions */
   [[eosio::action]] void voteaccount(const name& voter, const name& account, uint8_t vote_type);
   using voteaccount_action = eosio::action_wrapper<"voteaccount"_n, &sentiment::voteaccount>;

   [[eosio::action]] void rmacctvote(const name& voter, const name& account);
   using rmacctvote_action = eosio::action_wrapper<"rmacctvote"_n, &sentiment::rmacctvote>;

   /** Msig Voting Actions */
   [[eosio::action]] void
   votemsig(const name& voter, const name& proposer, const name& proposal_name, uint8_t vote_type);
   using votemsig_action = eosio::action_wrapper<"votemsig"_n, &sentiment::votemsig>;

   [[eosio::action]] void rmmsigvote(const name& voter, const name& proposer, const name& proposal_name);
   using rmmsigvote_action = eosio::action_wrapper<"rmmsigvote"_n, &sentiment::rmmsigvote>;

   /** Read-Only Actions */
   [[eosio::action, eosio::read_only]] get_topic_response gettopic(const name& id);
   using gettopic_action = eosio::action_wrapper<"gettopic"_n, &sentiment::gettopic>;

   [[eosio::action, eosio::read_only]] vector<get_topic_response> gettopics();
   using gettopics_action = eosio::action_wrapper<"gettopics"_n, &sentiment::gettopics>;

   [[eosio::action, eosio::read_only]] get_topic_vote_response gettopicvote(const name& voter, const name& topic_id);
   using gettopicvote_action = eosio::action_wrapper<"gettopicvote"_n, &sentiment::gettopicvote>;

   // DEPRECATED: Use gettopicvote() instead. Kept for backwards compatibility, may be removed in future.
   [[eosio::action, eosio::read_only]] get_topic_vote_response getvote(const name& voter, const name& topic_id);
   using getvote_action = eosio::action_wrapper<"getvote"_n, &sentiment::getvote>;

   [[eosio::action, eosio::read_only]] vector<get_topic_vote_response> gettopicvtrs(const name& topic_id);
   using gettopicvtrs_action = eosio::action_wrapper<"gettopicvtrs"_n, &sentiment::gettopicvtrs>;

   // DEPRECATED: Use gettopicvtrs() instead. Kept for backwards compatibility, may be removed in future.
   [[eosio::action, eosio::read_only]] vector<get_topic_vote_response> getvoters(const name& topic_id);
   using getvoters_action = eosio::action_wrapper<"getvoters"_n, &sentiment::getvoters>;

   [[eosio::action, eosio::read_only]] get_account_vote_response getacctvote(const name& voter, const name& account);
   using getacctvote_action = eosio::action_wrapper<"getacctvote"_n, &sentiment::getacctvote>;

   [[eosio::action, eosio::read_only]] vector<get_account_vote_response> getactvtrs(const name& account);
   using getactvtrs_action = eosio::action_wrapper<"getactvtrs"_n, &sentiment::getactvtrs>;

   [[eosio::action, eosio::read_only]] get_msig_vote_response
   getmsigvote(const name& voter, const name& proposer, const name& proposal_name);
   using getmsigvote_action = eosio::action_wrapper<"getmsigvote"_n, &sentiment::getmsigvote>;

   [[eosio::action, eosio::read_only]] vector<get_msig_vote_response> getmsigvtrs(const name& proposer,
                                                                                  const name& proposal_name);
   using getmsigvtrs_action = eosio::action_wrapper<"getmsigvtrs"_n, &sentiment::getmsigvtrs>;

   [[eosio::action, eosio::read_only]] get_voter_weight_response getweight(const name& voter);
   using getweight_action = eosio::action_wrapper<"getweight"_n, &sentiment::getweight>;

   [[eosio::action, eosio::read_only]] vector<get_voter_weight_response> getweights(const vector<name>& voters);
   using getweights_action = eosio::action_wrapper<"getweights"_n, &sentiment::getweights>;

#ifdef DEBUG
   [[eosio::action]] void reset();
#endif

private:
   config_row get_config();
   void       require_enabled(const config_row& config) { check(config.enabled, "contract is disabled"); }
   get_voter_weight_response get_voter_weight(const config_row& config, const name& voter);

   void  add_balance(const name& account, const asset& quantity);
   asset get_balance(const name& account, const symbol& token_symbol);
   void  remove_balance(const name& account, const asset& quantity);

#ifdef DEBUG
   template <typename T>
   void clear_table(T& table, uint64_t rows_to_clear);
#endif
};

} // namespace vaultacontracts
