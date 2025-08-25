#include <registry/registry.hpp>
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

registry::registry::token_row tokens::get_token(const config_row& config, const symbol_code& ticker)
{
   check(config.registry.value != 0, "registry contract not set");
   registry::registry::token_table tokens(config.registry, config.registry.value);
   auto                            token_itr = tokens.find(ticker.raw());
   check(token_itr != tokens.end(), "token is not registered in registry contract");
   return *token_itr;
}

[[eosio::action]] void tokens::distribute(const symbol_code&                             ticker,
                                          const std::vector<antelope::token_allocation>& allocations)
{
   check(allocations.size() > 0, "must provide at least one token allocation");

   config_table _config(get_self(), get_self().value);
   auto         config = _config.get_or_default();

   // Retrieve the token from the registry contract
   auto token = get_token(config, ticker);
   check(token.contract == get_self(), "token is not registered to this contract");

   require_auth(token.creator);

   // Ensure the supply has been established
   stats stats(get_self(), token.ticker.raw());
   auto  stat_itr = stats.find(token.ticker.raw());
   check(stat_itr != stats.end(), "supply not established");
   check(stat_itr->supply == stat_itr->max_supply, "supply must be fully allocated");

   // Ensure the token balance exists on the tokens contract
   tokens::accounts accounts(get_self(), get_self().value);
   auto             account_itr = accounts.find(token.ticker.raw());
   check(account_itr != accounts.end(), "contract balance not found");
   check(account_itr->balance == stat_itr->max_supply, "token has already been distributed");

   // Validate allocations against supply
   antelope::check_allocations(stat_itr->max_supply, allocations);

   // Perform the allocations
   for (const auto& allocation : allocations) {
      // Ensure each allocation goes to an account with an open balance
      tokens::accounts receiver_accounts(get_self(), allocation.receiver.value);
      auto             open_itr = receiver_accounts.find(ticker.raw());
      check(open_itr != receiver_accounts.end(),
            "balance must be opened first for: " + allocation.receiver.to_string());

      // Distribute tokens from tokens contract
      transfer_action transfer_act{get_self(), {{get_self(), eosiosystem::system_contract::active_permission}}};
      transfer_act.send(get_self(), allocation.receiver, allocation.quantity, "initial token allocation");
   }

   close_action close_act{get_self(), {{get_self(), eosiosystem::system_contract::active_permission}}};
   close_act.send(get_self(), stat_itr->supply.symbol);
}

[[eosio::action]] void tokens::setsupply(const symbol_code& ticker, const asset& supply)
{
   check(ticker == supply.symbol.code(), "ticker must match supply symbol");

   config_table _config(get_self(), get_self().value);
   auto         config = _config.get_or_default();

   // Retrieve the token from the registry contract
   auto token = get_token(config, ticker);
   check(token.contract == get_self(), "token is not registered to this contract");

   require_auth(token.creator);

   // Create the token
   check(supply.is_valid(), "invalid supply");
   check(supply.amount > 0, "max-supply must be positive");

   stats statstable(get_self(), token.ticker.raw());
   auto  existing = statstable.find(token.ticker.raw());
   check(existing == statstable.end(), "token supply has already been set");

   // Create the token stat entry
   statstable.emplace(token.creator, [&](auto& s) {
      s.supply.symbol = supply.symbol;
      s.supply        = supply;
      s.max_supply    = supply;
      s.issuer        = config.registry;
   });

   // Add the entire supply to the contract's balance, held until distributed via allocations
   add_balance(get_self(), supply, token.creator);
}

// Mirror of `transfer`, except calls `sub_balance_same_payer()` instead of `sub_balance()`
void tokens::transfer2(const name& from, const name& to, const asset& quantity, const string& memo)
{
   check(from != to, "cannot transfer to self");
   require_auth(from);
   check(is_account(to), "to account does not exist");
   auto        sym = quantity.symbol.code();
   stats       statstable(get_self(), sym.raw());
   const auto& st = statstable.get(sym.raw());

   require_recipient(from);
   require_recipient(to);

   check(quantity.is_valid(), "invalid quantity");
   check(quantity.amount > 0, "must transfer positive quantity");
   check(quantity.symbol == st.supply.symbol, "symbol precision mismatch");
   check(memo.size() <= 256, "memo has more than 256 bytes");

   auto payer = has_auth(to) ? to : from;

   sub_balance_same_payer(from, quantity);
   add_balance(to, quantity, payer);
}

// Mirror of `sub_balance` method, except the RAM payer uses `same_payer` instead of `owner`
void tokens::sub_balance_same_payer(const name& owner, const asset& value)
{
   accounts from_acnts(get_self(), owner.value);

   const auto& from = from_acnts.get(value.symbol.code().raw(), "no balance object found");
   check(from.balance.amount >= value.amount, "overdrawn balance");

   from_acnts.modify(from, same_payer, [&](auto& a) { a.balance -= value; });
}

} // namespace tokens