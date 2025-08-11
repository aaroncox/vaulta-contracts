#include "contractname/contractname.hpp"

#include "debug.cpp" // DEBUG (only used on dev builds for testnet)

namespace contractname {

[[eosio::action]] void contractname::foo(const string bar) { require_auth(get_self()); }

} // namespace contractname
