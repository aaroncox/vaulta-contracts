namespace vaultacontracts {

void sentiment::add_balance(const name& account, const asset& quantity)
{
   balance_table balances(get_self(), get_self().value);
   auto          balance_itr = balances.find(account.value);
   check(balance_itr != balances.end(), "balance row does not exist, call open first");
   balances.modify(balance_itr, same_payer, [&](auto& b) { b.balance += quantity; });
}

asset sentiment::get_balance(const name& account, const symbol& token_symbol)
{
   balance_table balances(get_self(), get_self().value);
   auto          balance_itr = balances.find(account.value);
   if (balance_itr != balances.end()) {
      return balance_itr->balance;
   } else {
      return asset(0, token_symbol);
   }
}

void sentiment::remove_balance(const name& account, const asset& quantity)
{
   balance_table balances(get_self(), get_self().value);
   auto          balance_itr = balances.find(account.value);
   check(balance_itr != balances.end(), "no contract balance for account");
   check(balance_itr->balance.amount >= quantity.amount, "insufficient contract balance");

   if (balance_itr->balance.amount == quantity.amount) {
      balances.erase(balance_itr);
   } else {
      balances.modify(balance_itr, same_payer, [&](auto& b) { b.balance -= quantity; });
   }
}

[[eosio::action]] void sentiment::open(const name& account)
{
   require_auth(account);

   auto config = get_config();
   require_enabled(config);

   balance_table balances(get_self(), get_self().value);
   auto          balance_itr = balances.find(account.value);
   if (balance_itr != balances.end()) return;

   balances.emplace(account, [&](auto& b) {
      b.account = account;
      b.balance = asset(0, config.fees.token.symbol);
   });
}

[[eosio::on_notify("*::transfer")]] void
sentiment::on_transfer(const name& from, const name& to, const asset& quantity, const string& memo)
{
   if (from == "eosio.ram"_n || to != get_self()) {
      return;
   }

   if (from == get_self()) {
      return;
   }

   auto config = get_config();
   require_enabled(config);

   if (get_first_receiver() != config.fees.token.contract) return;
   check(quantity.symbol == config.fees.token.symbol, "incorrect token symbol for deposit");
   check(quantity.amount > 0, "token quantity must be positive");

   add_balance(from, quantity);
}

[[eosio::action]] void sentiment::withdraw(const name& account, const asset& quantity)
{
   require_auth(account);

   auto config = get_config();
   require_enabled(config);

   check(quantity.symbol == config.fees.token.symbol, "incorrect token symbol for withdraw");
   check(quantity.amount > 0, "token quantity must be positive");
   remove_balance(account, quantity);

   token::transfer_action transfer_act{config.fees.token.contract,
                                       {{get_self(), eosiosystem::system_contract::active_permission}}};
   transfer_act.send(get_self(), account, quantity, "");
}

} // namespace vaultacontracts
