#include <sentiment/sentiment.hpp>

namespace vaultacontracts {

sentiment::config_row sentiment::get_config()
{
   config_table _config(get_self(), get_self().value);
   return _config.get_or_default();
}

[[eosio::action]] void sentiment::setconfig(const config_row& config)
{
   require_auth(get_self());
   config_table _config(get_self(), get_self().value);
   _config.set(config, get_self());
}

[[eosio::action]] void sentiment::enable()
{
   require_auth(get_self());
   config_table _config(get_self(), get_self().value);
   auto         config = _config.get_or_default();
   config.enabled      = true;
   _config.set(config, get_self());
}

[[eosio::action]] void sentiment::disable()
{
   require_auth(get_self());
   config_table _config(get_self(), get_self().value);
   auto         config = _config.get_or_default();
   config.enabled      = false;
   _config.set(config, get_self());
}

[[eosio::action]] void sentiment::createtopic(const name& id, const string& description)
{
   require_auth(get_self());

   topics_table topics(get_self(), get_self().value);

   auto itr = topics.find(id.value);
   check(itr == topics.end(), "topic with this ID already exists");

   topics.emplace(get_self(), [&](auto& row) {
      row.id          = id;
      row.description = description;
   });
}

[[eosio::action]] void sentiment::updatetopic(const name& id, const string& description)
{
   require_auth(get_self());

   topics_table topics(get_self(), get_self().value);

   auto itr = topics.find(id.value);
   check(itr != topics.end(), "topic does not exist");

   topics.modify(itr, same_payer, [&](auto& row) { row.description = description; });
}

[[eosio::action]] void sentiment::deletetopic(const name& id)
{
   require_auth(get_self());

   topics_table topics(get_self(), get_self().value);

   auto itr = topics.find(id.value);
   check(itr != topics.end(), "topic does not exist");

   // Delete all votes for this topic
   votes_table votes(get_self(), id.value);
   auto        vote_itr = votes.begin();
   while (vote_itr != votes.end()) {
      vote_itr = votes.erase(vote_itr);
   }

   topics.erase(itr);
}

[[eosio::action, eosio::read_only]] sentiment::get_topic_response sentiment::gettopic(const name& id)
{
   topics_table topics(get_self(), get_self().value);

   auto itr = topics.find(id.value);
   check(itr != topics.end(), "topic does not exist");

   return get_topic_response{.id = itr->id, .description = itr->description};
}

[[eosio::action, eosio::read_only]] vector<sentiment::get_topic_response> sentiment::gettopics()
{
   topics_table                          topics(get_self(), get_self().value);
   vector<sentiment::get_topic_response> results;

   for (auto itr = topics.begin(); itr != topics.end(); ++itr) {
      results.push_back(get_topic_response{.id = itr->id, .description = itr->description});
   }

   return results;
}

[[eosio::action]] void sentiment::vote(const name& voter, const name& topic_id, uint8_t vote_type)
{
   require_auth(voter);

   auto config = get_config();
   require_enabled(config);

   check(vote_type == 0 || vote_type == 1, "vote_type must be 0 (opposition) or 1 (support)");

   topics_table topics(get_self(), get_self().value);
   auto         topic_itr = topics.find(topic_id.value);
   check(topic_itr != topics.end(), "topic does not exist");

   votes_table votes(get_self(), topic_id.value);
   auto        vote_itr = votes.find(voter.value);
   check(vote_itr == votes.end(), "vote already exists, use changevote to modify");

   votes.emplace(voter, [&](auto& row) {
      row.voter     = voter;
      row.topic_id  = topic_id;
      row.vote_type = vote_type;
   });
}

[[eosio::action]] void sentiment::changevote(const name& voter, const name& topic_id, uint8_t vote_type)
{
   require_auth(voter);

   auto config = get_config();
   require_enabled(config);

   check(vote_type == 0 || vote_type == 1, "vote_type must be 0 (opposition) or 1 (support)");

   topics_table topics(get_self(), get_self().value);
   auto         topic_itr = topics.find(topic_id.value);
   check(topic_itr != topics.end(), "topic does not exist");

   votes_table votes(get_self(), topic_id.value);
   auto        vote_itr = votes.find(voter.value);
   check(vote_itr != votes.end(), "vote does not exist, use vote to create");

   uint8_t old_vote_type = vote_itr->vote_type;
   check(old_vote_type != vote_type, "new vote type is the same as current vote type");

   votes.modify(vote_itr, same_payer, [&](auto& row) { row.vote_type = vote_type; });
}

[[eosio::action]] void sentiment::removevote(const name& voter, const name& topic_id)
{
   require_auth(voter);

   auto config = get_config();
   require_enabled(config);

   topics_table topics(get_self(), get_self().value);
   auto         topic_itr = topics.find(topic_id.value);
   check(topic_itr != topics.end(), "topic does not exist");

   votes_table votes(get_self(), topic_id.value);
   auto        vote_itr = votes.find(voter.value);
   check(vote_itr != votes.end(), "vote does not exist");

   votes.erase(vote_itr);
}

[[eosio::action]] void sentiment::bulkrmvotes(const name& topic_id, uint32_t num_votes)
{
   require_auth(get_self());

   topics_table topics(get_self(), get_self().value);
   auto         topic_itr = topics.find(topic_id.value);
   check(topic_itr != topics.end(), "topic does not exist");

   votes_table votes(get_self(), topic_id.value);
   auto        vote_itr = votes.begin();
   uint32_t    deleted  = 0;

   while (vote_itr != votes.end() && deleted < num_votes) {
      vote_itr = votes.erase(vote_itr);
      deleted++;
   }
}

[[eosio::action, eosio::read_only]] sentiment::get_vote_response sentiment::getvote(const name& voter,
                                                                                    const name& topic_id)
{
   votes_table votes(get_self(), topic_id.value);
   auto        vote_itr = votes.find(voter.value);
   check(vote_itr != votes.end(), "vote does not exist");

   return get_vote_response{.voter = vote_itr->voter, .topic_id = vote_itr->topic_id, .vote_type = vote_itr->vote_type};
}

[[eosio::action, eosio::read_only]] vector<sentiment::get_vote_response> sentiment::getvoters(const name& topic_id)
{
   topics_table topics(get_self(), get_self().value);
   auto         topic_itr = topics.find(topic_id.value);
   check(topic_itr != topics.end(), "topic does not exist");

   votes_table                          votes(get_self(), topic_id.value);
   vector<sentiment::get_vote_response> results;

   for (auto itr = votes.begin(); itr != votes.end(); ++itr) {
      results.push_back(get_vote_response{.voter = itr->voter, .topic_id = itr->topic_id, .vote_type = itr->vote_type});
   }

   return results;
}

} // namespace vaultacontracts

#ifdef DEBUG
#include "debug.cpp"
#endif
