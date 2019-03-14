const Patenting = artifacts.require("./Patenting.sol");

contract("Test Patenting", async accounts => {
  it("setting IPFS location", async () => {
    const patentName = 'testFile.pdf';
    let instance = await Patenting.at('0xddfc2E31EEcA6Ed9E39ed4B7BA30F7217B3032A3');
    console.log('contract deployed');
    await instance.depositPatent.call(patentName, 'sha256Hash', 0, 'QmHash1', 'test@email.com');
    console.log('patent deposited');
    await instance.setIpfs.call(patentName, 'QmHash2');
    const location = await contract.getPatentLocation.call(patentName);
    console.log(location);
    assert.equal(
      location,
      'QmHash2',
      "Location has not been modified" + location
    );
  });
});