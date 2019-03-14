const AccessRestricted = artifacts.require("./AccessRestricted.sol");
const Patenting = artifacts.require("./Patenting.sol");
const TimeStamping = artifacts.require("./TimeStamping.sol");

module.exports = function(deployer) {
  deployer.deploy(AccessRestricted);
  deployer.deploy(TimeStamping, 10, '0x2CDe56E5c8235D6360CCbb0c57Ce248Ca9C80909');
  deployer.deploy(Patenting, 10, '0x2CDe56E5c8235D6360CCbb0c57Ce248Ca9C80909');
};

