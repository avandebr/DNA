const AccessRestricted = artifacts.require("./AccessRestricted.sol");
const TimeStamping = artifacts.require("./TimeStamping.sol");
const Patenting = artifacts.require("./Patenting.sol");

const FiatAddress = '0x2CDe56E5c8235D6360CCbb0c57Ce248Ca9C80909';

module.exports = function(deployer) {
  deployer.deploy(AccessRestricted);
  deployer.deploy(TimeStamping, 10, FiatAddress);
  deployer.deploy(Patenting, 10, FiatAddress);
};


