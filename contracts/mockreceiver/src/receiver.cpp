namespace mockreceiver {
[[eosio::on_notify("*::transfer")]] void

/**
 * An example of how contracts interacting with this system should handle transfers
 * 
 * Some special attention is required to ensure these receiving contracts dont consume their own RAM.
 */
mockreceiver::on_transfer(const name& from, const name& to, const asset& quantity, const string& memo)
{
   // ignore RAM sales
   // ignore transfers not sent to this contract
   if (from == "eosio.ram"_n || to != get_self()) {
      return;
   }

   // ignore transfers sent from this contract to purchase RAM
   // otherwise revert transaction if sending EOS outside of this contract if RAM transfer is enabled
   if (from == get_self()) {
      if (to == "eosio.ram"_n || to == "eosio.ramfee"_n) {
         return;
      }
      return;
   }

   config_table _config(get_self(), get_self().value);
   auto         config = _config.get_or_default();

   check(get_first_receiver() == config.tokencontract,
         "Only the configured token contract may send tokens to the mockreceiver.");
   check(config.sender == from, "Tokens must be sent from the configured sender account.");

   // Automatically forward tokens to the configured destination
   eosio::token::transfer_action transfer_act{config.tokencontract, {{get_self(), "active"_n}}};
   transfer_act.send(get_self(), config.destination, quantity, "");
}

[[eosio::action]] void mockreceiver::setconfig(const name tokencontract, const name sender, const name destination)
{
   require_auth(get_self());
   config_table _config(get_self(), get_self().value);
   auto         config  = _config.get_or_default();
   config.tokencontract = tokencontract;
   config.sender        = sender;
   config.destination   = destination;
   _config.set(config, get_self());
}

} // namespace mockreceiver