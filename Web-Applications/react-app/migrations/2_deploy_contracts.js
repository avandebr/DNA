const AccessRestricted = artifacts.require("./AccessRestricted.sol");
const Patents = artifacts.require("./Patents.sol");
const Requests = artifacts.require("./Requests.sol");
const Users = artifacts.require("./Users.sol");

const FiatAddress = '0x2CDe56E5c8235D6360CCbb0c57Ce248Ca9C80909';

module.exports = function(deployer) {
  deployer.deploy(AccessRestricted);
  deployer.deploy(Users).then(usersInstance => {
    return deployer.deploy(Patents, 10, 1, FiatAddress, usersInstance.address).then(patentsInstance => {
      return deployer.deploy(Requests, patentsInstance.address).then(requestsInstance => {
        return patentsInstance.setRequestsAddress(requestsInstance.address);
      })
    })
  });
};


