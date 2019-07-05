pragma solidity ^0.5.0;

import './AccessRestricted.sol';
import './FiatContract.sol';
import './Requests.sol';
import './Users.sol';

contract Patents is AccessRestricted {

    // TODO: add text to require
    // TODO: function to set a patent ownership ?

    uint public depositPrice; // price to pay to deposit a patent
    uint public newVersionPrice; // price to pay to add a version to a patent

    FiatContract fiat;
    Requests requests;
    Users users;

    // TODO: also store sha256 hashes to compare new version with olders ?
    /* Struct for patent */
    struct Patent {
        string name;
        address owner;
        string folderHash;
        uint[] timestamps;
        string[] ipfs;
        uint[] licencePrices;
        bool deleted;
        address[] buyers;
        mapping(address => uint8) rates;
    }

    string[] public patentIDs; // registered patent hashes
    mapping(string => Patent) private patents; // patent ID (hash) to Patents information

    string[] public folderIDs; // registered folder hashes
    mapping(string => string[]) private folders; // folder ID (hash) to patentIDs

    // ========================================= CONSTRUCTOR AND SETTERS ============================================

    /* Constructor of the contract
    * {param} uint : The price for depositing a pattern in Wei
    */
    constructor(uint _depositPrice, uint _newVersionPrice, address _fiatAddress, address _usersAddress) public {
        fiat = FiatContract(_fiatAddress);
        // requests = Requests(_requestsAddress);
        users = Users(_usersAddress);
        depositPrice = _depositPrice;
        newVersionPrice = _newVersionPrice;
    }

    /*For donations*/
    function() external payable {}

    /*Allows the contract owner to withdraw the remaining funds*/
    function withdrawFunds() public onlyOwner {
        owner.transfer(address(this).balance);
    }

    /*Allows the contract owner to modify the price to deposit a new patent*/
    function setDepositPrice(uint _newPrice) public onlyOwner {
        depositPrice = _newPrice;
    }

    /*Allows the contract owner to modify the price to deposit a new patent*/
    function setNewVersionPrice(uint _newPrice) public onlyOwner {
        newVersionPrice = _newPrice;
    }

    /*Allows the contract owner to modify the address of the Fiat Contract in case it would change*/
    function setFiatAddress(uint _newAddress) public onlyOwner {
        fiat = FiatContract(_newAddress);
    }

    /*Allows the contract owner to modify the address of the requests contract in case it would change*/
    function setRequestsAddress(uint _newAddress) public onlyOwner {
        requests = Requests(_newAddress);
    }

    // ========================================= PATENTING FUNCTIONS ============================================

    /* Function to register a folder information
    * {params} the folder parameters
    */
    function depositFolder(string memory _folderName, string memory _folderHash, uint[] memory _licencePrices) public {
        require(users.isRegistered(msg.sender) && !isRegistered(_folderHash));
        uint[] memory timestamps = new uint[](1); timestamps[0] = now;
        string[] memory ipfs = new string[](1); ipfs[0] = '';
        patents[_folderHash] = Patent(_folderName, msg.sender, '', timestamps, ipfs, _licencePrices, false, new address[](0));
        folderIDs.push(_folderHash);
        users.addFolder(msg.sender, _folderHash);
        // emit event
    }

    /* Function to deposit a patent
    * {params} the patent parameters
    * {costs} the price of a patent
    */
    function depositPatent(string memory _patentName, string memory _patentHash, string memory _folderHash, string memory _ipfs, uint[] memory _licencePrices) public payable {
        require(users.isRegistered(msg.sender) && !isRegistered(_patentHash) && msg.value >= getEthPrice(depositPrice));
        string[] memory ipfs = new string[](1); ipfs[0] = _ipfs;
        uint[] memory timestamps = new uint[](1); // timestamps[0] = now;
        timestamps[0] = isRegistered(_folderHash) ? patents[_folderHash].timestamps[0] : now;
        patents[_patentHash] = Patent(_patentName, msg.sender, _folderHash, timestamps, ipfs, _licencePrices, false, new address[](0));
        patentIDs.push(_patentHash);
        users.addPatent(msg.sender, _patentHash);
        folders[_folderHash].push(_patentHash);
        // emit event
    }

    /* Function to modify the licences and prices of the given _patentID */
    function modifyPatent(string memory _patentID, string memory _newName, uint[] memory _newLicencePrices) public {
        require(isRegistered(_patentID) && isOwner(_patentID, msg.sender));
        Patent storage p = patents[_patentID];
        p.name = _newName;
        p.licencePrices = _newLicencePrices;
    }

    /* Function to add a version to the given _patentID*/
    function addVersion(string memory _patentID, string memory newIpfsLocation) public payable {
        require(users.isRegistered(msg.sender) && isRegistered(_patentID) && msg.value >= getEthPrice(newVersionPrice));
        Patent storage p = patents[_patentID];
        p.ipfs.push(newIpfsLocation);
        p.timestamps.push(now);
    }

    /* delete or undelete a patent (i.e. set its visibility wrt other users) */
    function setVisibility(string memory _patentID) public {
        require(isRegistered(_patentID) && isOwner(_patentID, msg.sender));
        Patent storage p = patents[_patentID];
        p.deleted = !p.deleted;
    }

    function addBuyer(string memory _patentID, address _userID) public {
        require(isRegistered(_patentID) && requests.hasRequested(_patentID, _userID));
        Patent storage p = patents[_patentID];
        p.buyers.push(_userID);
    }

    function ratePatent(string memory _patentID, uint8 _rate) public {
        require(isRegistered(_patentID) && requests.getAcceptedLicence(_patentID, msg.sender) > 0 && _rate >= 0 && _rate <= 5);
        Patent storage p = patents[_patentID];
        p.rates[msg.sender] = _rate;
    }

    /* ============================== View functions that do not require transactions ============================== */

    /*Returns number of deposited patents*/
    function patentCount() public view returns (uint){
        return patentIDs.length;
    }

    /*Returns number of deposited folders*/
    function folderCount() public view returns (uint){
        return folderIDs.length;
    }

    /*Returns number of versions of the _patentID*/
    function getNumVersions(string memory _patentID) public view returns (uint) {
        return patents[_patentID].ipfs.length;
    }

    /*Returns number of patents of the _folderID*/
    function getFolderSize(string memory _folderID) public view returns (uint) {
        return folders[_folderID].length;
    }

    /*Returns the patentID of the _folderID given by _index*/
    function getPatentID(string memory _folderID, uint _index) public view returns (string memory) {
        return folders[_folderID][_index];
    }

    /*Returns patent's name*/
    function getPatentName(string memory _patentID) public view returns (string memory) {
        return patents[_patentID].name;
    }

    /*Returns patent's owner*/
    function getPatentOwner(string memory _patentID) public view returns (address) {
        return patents[_patentID].owner;
    }

    /*Returns the IPFS location of the _patentID version given by _index*/
    function getPatentLocation(string memory _patentID, uint _index) public view returns (string memory) {
        return patents[_patentID].ipfs[_index];
    }

    /*Returns the IPFS location of the _patentID version given by _index*/
    function getTimestamp(string memory _patentID, uint _index) public view returns (uint) {
        return patents[_patentID].timestamps[_index];
    }

    /*Returns the price of a patent*/
    function getFolderHash(string memory _patentID) public view returns (string memory) {
        return patents[_patentID].folderHash;
    }

    /*Returns true if account is owner of given patent*/
    function isOwner(string memory _patentID, address _userID) public view returns (bool){
        return getPatentOwner(_patentID) == _userID;
    }

    /*Returns true if the patent has been deleted*/
    function isDeleted(string memory _patentID) public view returns (bool) {
        return patents[_patentID].deleted;
    }

    /* Returns the maximum licence to be requested of the given patent */
    function getMaxLicence(string memory _patentID) public view returns (uint){
        return patents[_patentID].licencePrices.length;
    }

    /*Returns the price of a patent for a given licence*/
    function getPrice(string memory _patentID, uint _licence) public view returns (uint) {
        // index by licence-1 cause licence 0 price not stored in licence prices since free
        return patents[_patentID].licencePrices[_licence-1];
    }

    /*Returns the prices of a patent*/
    function getPrices(string memory _patentID) public view returns (uint[] memory) {
        return patents[_patentID].licencePrices;
    }

    /*Returns the number of requests for the given patent*/
    function getNumRequests(string memory _patentID) public view returns (uint){
        return patents[_patentID].buyers.length;
    }

    /*Returns the address of the buyer at _index  (Used for iterating)*/
    function getBuyers(string memory _patentID, uint _index) public view returns (address){
        return patents[_patentID].buyers[_index];
    }

    /*Returns the rate given by the _userID to the _patentID*/
    function getRate(string memory _patentID, address _userID) public view returns (uint8){
        return patents[_patentID].rates[_userID];
    }

    /*Returns the email address of the _patentID's owner*/
    function getOwnerEmail(string memory _patentID) public view returns (string memory) {
        return users.getEmail(patents[_patentID].owner);
    }

    /*Returns the email address of the _patentID's owner*/
    function getOwnerName(string memory _patentID) public view returns (string memory) {
        return users.getName(patents[_patentID].owner);
    }

    /*Returns true if the given ID (patent or folder) has already been registered*/
    function isRegistered(string memory _id) public view returns (bool) {
        return patents[_id].owner != address(0);
    }

    /*Returns true if the given patent ID has already been registered*/
    function hasAccount(address _userID) public view returns (bool) {
        return users.isRegistered(_userID);
    }

    function getEthPrice(uint _dollars) public view returns (uint) {
        // return fiat.USD(0) * 100 * _dollars;
        return _dollars / 200;
    }
}
