#include <tokens/tokens.hpp>

namespace tokens {

[[eosio::action]] void tokens::setconfig(const name registry)
{
   require_auth(get_self());
   config_table _config(get_self(), get_self().value);
   auto         config = _config.get_or_default();
   config.registry     = registry;
   _config.set(config, get_self());
}

[[eosio::on_notify("*::regtoken")]] void
tokens::register_token(const name&                                    contract,
                       const name&                                    issuer,
                       const asset&                                   supply,
                       const std::vector<antelope::token_allocation>& allocations,
                       const asset&                                   fee)
{
   config_table _config(get_self(), get_self().value);
   auto         config = _config.get_or_default();

   // Ensure that the notification is coming from the registry contract
   auto calling_contract = get_first_receiver();
   check(calling_contract == config.registry, "regtoken can only be called from the registry contract");

   // Create the token
   auto sym = supply.symbol;
   check(supply.is_valid(), "invalid supply");
   check(supply.amount > 0, "max-supply must be positive");

   stats statstable(get_self(), sym.code().raw());
   auto  existing = statstable.find(sym.code().raw());
   check(existing == statstable.end(), "token with symbol already exists");

   // Validate allocations against supply
   antelope::check_allocations(supply, allocations);

   // Create the token stat entry
   statstable.emplace(get_self(), [&](auto& s) {
      s.supply.symbol = supply.symbol;
      s.supply        = supply;
      s.max_supply    = supply;
      s.issuer        = calling_contract;
   });

   // Perform the allocations
   for (const auto& allocation : allocations) {
      add_balance(allocation.receiver, allocation.quantity, get_self());
      allocate_action allocate_act{get_self(), {{get_self(), eosiosystem::system_contract::active_permission}}};
      allocate_act.send(issuer, allocation.receiver, allocation.quantity);
   }
}

void tokens::allocate(const name& issuer, const name& receiver, const asset& quantity)
{
   require_auth(get_self());
   require_recipient(issuer);
   require_recipient(receiver);
}

} // namespace tokens