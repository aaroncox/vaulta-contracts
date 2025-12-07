#include <sentiment/sentiment.hpp>

namespace vaultacontracts {
// Main entry point - all logic is in modular files
} // namespace vaultacontracts

// Include modular action implementations
#include "config.cpp"
#include "weights.cpp"
#include "topics.cpp"
#include "account.cpp"
#include "msig.cpp"

#ifdef DEBUG
#include "debug.cpp"
#endif
