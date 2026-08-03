namespace vaultacontracts {

void gift::reset()
{
   require_auth(get_self());
   operators_table operators(get_self(), get_self().value);
   auto            itr = operators.begin();
   while (itr != operators.end()) {
      itr = operators.erase(itr);
   }
}

} // namespace vaultacontracts
