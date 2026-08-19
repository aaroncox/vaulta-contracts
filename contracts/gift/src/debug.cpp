namespace vaultacontracts {

void gift::reset()
{
   require_auth(get_self());
   creators_table creators(get_self(), get_self().value);
   auto           itr = creators.begin();
   while (itr != creators.end()) {
      itr = creators.erase(itr);
   }
}

} // namespace vaultacontracts
