namespace mockreceiver {

[[eosio::action]] void mockreceiver::reset()
{
   require_auth(get_self());

   config_table _config(get_self(), get_self().value);
   _config.remove();
}

} // namespace mockreceiver