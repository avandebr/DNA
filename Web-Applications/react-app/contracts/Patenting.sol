pragma solidity ^0.5.0;

import './AccessRestricted.sol';
import './TimeStamping.sol';
import './FiatContract.sol';

contract Patenting is AccessRestricted {

    uint public patentPrice;
    uint public patentCount;
    uint public albumCount;

    enum RequestStatus {Not_requested, Pending, Rejected, Cancelled, Accepted}

    /* Struct for request */
    struct Request {
        RequestStatus status;
        uint acceptedLicence;  // can put uint8 ?
        uint requestedLicence; // can put uint8 ?
        uint deposit;
        string email;
        string encryptionKey;
        string encryptedIpfsKey;
    }

    /* Struct for patent */
    struct Patent {
        address owner;
        uint timestamp;
        string patentHash;
        string ipfs;
        string email;
        uint numRequests;
        uint maxLicence;  // can put uint8 ?
        uint[] licencePrices;
        bool deleted;
        mapping(uint => address) buyers;
        mapping(address => Request) requests;
    }

    struct Album {
        Patent patent; // album info, same infos than single patent
        // string[] songsName;
    }

    // mapping for songs
    string[] public patentNames;
    mapping(string => Patent) private patents; // patent name to Patent

    // mapping for albums
    string[] public albumNames;
    mapping(string => Album) private albums; // album name to Album

    event NewRequest(
        string _ownerMail,
        string _patentName,
        address _rentee
        // uint _requestedLicence
    );

    event RequestResponse(
        string _requesterEmail,
        string _patentName,
        bool _accepted
    );

    // FiatContract fiat;

    /* Constructor of the contract
    * {param} uint : The price for depositing a pattern in Wei
    */
    constructor(uint _patentPrice, address _fiatContract) public {
        // fiat = FiatContract(_fiatContract);
        patentPrice = _patentPrice;
    }

    /*Allows the owner to withdraw the remaining funds*/
    function withdrawFunds() public onlyOwner {
        owner.transfer(address(this).balance);
    }

    function getEthPrice(uint _dollars) public view returns (uint) {
        // return fiat.USD(0) * 100 * _dollars;
        return _dollars / 130;
    }

    /* ======================================== DEPOSIT FUNCTIONS ======================================= */

    /* Function to deposit a patent
    * {params} the patent parameters
    * {costs} the price of a patent
    */
    function depositPatent(string memory _patentName, string memory _patentHash, uint _maxLicence, uint[] memory _licencePrices, string memory _ipfs, string memory _email) public payable {
        require(patents[_patentName].timestamp == 0 && msg.value >= getEthPrice(patentPrice) && _licencePrices.length == _maxLicence);
        patents[_patentName] = Patent(msg.sender, now, _patentHash, _ipfs, _email, 0, _maxLicence, _licencePrices, false);
        patentNames.push(_patentName);
        patentCount++;
    }

    /* ======================================== PATENT MANAGEMENT FUNCTIONS ======================================= */

    /* Function called when a file is updated to set its IPFS location
    * {params} the new IPFS location
    */
    function setIpfsLocation(string memory _patentName, string memory _newIpfs) public {
        // require(isRegistered(_patentName) && isOwner(_patentName, msg.sender));
        // if(patents[_patentName].ipfs != _newIpfs)
        Patent storage p = patents[_patentName];
        p.ipfs = _newIpfs;

        // emit un event pour notifier que ca a change et envoyer un mail aux buyers du patent
        // emit modifiedPatent(true);
    }

    /* delete a patent (i.e. not accessible to other users) */
    function deletePatent(string memory _patentName) public {
        require(isRegistered(_patentName) && isOwner(_patentName, msg.sender) && !isDeleted(_patentName));
        Patent storage p = patents[_patentName];
        p.deleted = true;
        patentCount--;
    }

    /* ======================================== REQUEST MANAGEMENT FUNCTIONS ======================================= */

    /* ------------------------------------------ NEW REQUESTS MANAGEMENT ------------------------------------------ */

    /* Function to request access to a patent
    * {params} _patentName : name of patent
    *          _requestedLicence : licence requested for the patent
    *          _encryptionKey : key to encrypt AES key with (key exchange protocol)
    * {costs} price of the patent : will be frozen until request is accepted, rejected, or cancelled
    */
    function requestAccess(string memory _patentName, uint _requestedLicence, string memory _encryptionKey, string memory _email) public payable {
        require(isRegistered(_patentName) && canRequest(_patentName, msg.sender));
        require(_requestedLicence > 0 && _requestedLicence <= patents[_patentName].maxLicence);
        uint ethPrice = getEthPrice(getPrice(_patentName, _requestedLicence));
        require(msg.value >= ethPrice);
        Patent storage p = patents[_patentName];
        if (p.requests[msg.sender].status == RequestStatus.Not_requested) {
            p.buyers[p.numRequests++] = msg.sender;
        }
        p.requests[msg.sender] = Request(RequestStatus.Pending, 0, _requestedLicence, ethPrice, _email, _encryptionKey, "");
        emit NewRequest(patents[_patentName].email, _patentName, msg.sender); // put licence in event
    }

    /* Resend a rejected or cancelled request */
    function resendRequest(string memory _patentName, uint _requestedLicence) public payable {
        require(isRegistered(_patentName) && canRequest(_patentName, msg.sender) && hasBeenRequested(_patentName, msg.sender));
        require(_requestedLicence > 0 && _requestedLicence <= patents[_patentName].maxLicence);
        uint ethPrice = getEthPrice(getPrice(_patentName, _requestedLicence));
        require(msg.value >= ethPrice);
        Request storage r = patents[_patentName].requests[msg.sender];
        r.status = RequestStatus.Pending;
        r.requestedLicence = _requestedLicence;
        r.deposit = ethPrice;
    }

    /* Function to grant access to a user
    * {params} _patentName : name of patent
    *          _user : user to give access to (must have requested)
    *          _encryptedIpfsKey : encrypted AES key to decrypt file on ipfs
    *   Transfers the amount to the patent owner
    */
    function grantAccess(string memory _patentName, address _user, string memory _encryptedIpfsKey) public {
        require(isRegistered(_patentName) && isOwner(_patentName, msg.sender) && isPending(_patentName, _user));
        Request storage r = patents[_patentName].requests[_user];
        require(r.deposit >= 0);
        msg.sender.transfer(r.deposit);
        r.deposit = 0;
        r.status = RequestStatus.Accepted;
        r.acceptedLicence = r.requestedLicence;
        // r.requestedLicence = 0;
        r.encryptedIpfsKey = _encryptedIpfsKey;
        emit RequestResponse(r.email, _patentName, true); // put licence in event
    }

    /* Function to reject access to a patent
    * {params} : Same as above
    * Refunds the amount to the user
    */
    function rejectAccess(string memory _patentName, address payable _user) public {
        require(isRegistered(_patentName) && isOwner(_patentName, msg.sender) && isPending(_patentName, _user));
        Request storage r = patents[_patentName].requests[_user];
        require(r.deposit >= 0);
        // Refund back to user
        _user.transfer(r.deposit);
        r.deposit = 0;
        r.status = RequestStatus.Rejected;
        emit RequestResponse(r.email, _patentName, false);
    }

    /* Function that cancels a request (can only be called by user)
    * {params} : _patentName : name of patent
    */
    function cancelRequest(string memory _patentName) public {
        require(isRegistered(_patentName) && isPending(_patentName, msg.sender));
        Request storage r = patents[_patentName].requests[msg.sender];
        require(r.deposit >= 0);
        msg.sender.transfer(r.deposit);
        r.deposit = 0;
        r.status = RequestStatus.Cancelled;
    }

    /* ---------------------------------------- UPGRADE MANAGEMENT FUNCTIONS ---------------------------------------- */

    /* Function to request a licence upgrade
    * {params} _patentName : name of patent
    *          _newRequestedLicence : new requested licence for the patent
    * {costs} price of the requested licence - price of owned licence: will be frozen until request is accepted, rejected, or cancelled
    */
    function requestUpgrade(string memory _patentName, uint _requestedLicence) public payable {
        require(isRegistered(_patentName) && canUpgrade(_patentName, msg.sender)); // && !patents[_patentName].deleted
        uint userLicence = patents[_patentName].requests[msg.sender].acceptedLicence;
        require(_requestedLicence <= patents[_patentName].maxLicence && _requestedLicence > userLicence);
        // just pay the difference
        uint price = getPrice(_patentName, _requestedLicence) - getPrice(_patentName, userLicence);
        uint ethPrice = getEthPrice(price);
        require(msg.value >= ethPrice);
        Request storage r = patents[_patentName].requests[msg.sender];
        r.status = RequestStatus.Pending;
        r.requestedLicence = _requestedLicence;
        r.deposit = ethPrice;
        // emit NewUpgradeRequest(patents[_patentName].email, _patentName, _newRequestedLicence, msg.sender);
    }

    /* Function to upgrade licence access to a user
    * {params} _patentName : name of patent
    *          _user : user to give access to (must have requested)
    *   Transfers the amount to the patent owner
    */
    function acceptUpgrade(string memory _patentName, address _user) public {
        require(isRegistered(_patentName) && isOwner(_patentName, msg.sender) && isPending(_patentName, _user));
        Request storage r = patents[_patentName].requests[_user];
        require(r.deposit >= 0);
        msg.sender.transfer(r.deposit);
        r.deposit = 0;
        r.status = RequestStatus.Accepted;
        r.acceptedLicence = r.requestedLicence;
        // r.requestedLicence = 0;
        // emit RequestResponse(r.email, _patentName, true); // put licence in event
    }

    /* Function to reject access to an upgrade request
    * {params} : Same as above
    * Refunds the amount to the user
    */
    function rejectUpgrade(string memory _patentName, address payable _user) public {
        require(isRegistered(_patentName) && isOwner(_patentName, msg.sender) && isPending(_patentName, _user));
        Request storage r = patents[_patentName].requests[_user];
        require(r.deposit >= 0);
        // Refund back to user
        _user.transfer(r.deposit);
        r.deposit = 0;
        // come back to previously accepted licence
        r.status = RequestStatus.Accepted;
        // r.requestedLicence = 0;
        // emit RequestResponse(r.email, _patentName, false); // put licence in event
    }

    /* Function that cancels an upgrade request (to be called by requester)
    * {params} : _patentName : name of patent
    */
    function cancelUpgrade(string memory _patentName) public {
        require(isRegistered(_patentName) && isPending(_patentName, msg.sender));
        Request storage r = patents[_patentName].requests[msg.sender];
        require(r.deposit >= 0);
        msg.sender.transfer(r.deposit);
        r.deposit = 0;
        // r.requestedLicence = 0;
        // come back to previously accepted licence
        r.status = RequestStatus.Accepted;
    }

    /* ============================== View functions that do not require transactions ============================== */

    /*Returns true if the given account can request the given patent : is either Not_requested, cancelled or rejected*/
    function canRequest(string memory _patentName, address _account) public view returns (bool){
        return !(isDeleted(_patentName) || isAccepted(_patentName, _account) || isPending(_patentName, _account) || isOwner(_patentName, _account));
    }

    /*Returns true if the given account can request the given patent : is either Not_requested, cancelled or rejected*/
    function canUpgrade(string memory _patentName, address _account) public view returns (bool){
        return !isDeleted(_patentName) && isAccepted(_patentName, _account) && !isPending(_patentName, _account) && !isOwner(_patentName, _account);
    }

    /*Returns the RequestStatus of the given patent for the given account*/
    function getRequestStatus(string memory _patentName, address _account) public view returns (RequestStatus){
        return patents[_patentName].requests[_account].status;
    }

    /* Returns the Requested licence of the given patent for the given account */
    function getRequestedLicence(string memory _patentName, address _account) public view returns (uint){
        return patents[_patentName].requests[_account].requestedLicence;
    }

    /* Returns the Requested licence of the given patent for the given account */
    function getAcceptedLicence(string memory _patentName, address _account) public view returns (uint){
        return patents[_patentName].requests[_account].acceptedLicence;
    }

    /* Returns the Requested licence of the given patent for the given account */
    function getMaxLicence(string memory _patentName) public view returns (uint){
        return patents[_patentName].maxLicence;
    }

    /*Returns true of the given account has already requested the given patent*/
    function hasBeenRequested(string memory _patentName, address _account) public view returns (bool){
        return patents[_patentName].requests[_account].status != RequestStatus.Not_requested;
    }

    /*Returns true of the given account has a pending request on the given patent*/
    function isPending(string memory _patentName, address _account) public view returns (bool){
        return patents[_patentName].requests[_account].status == RequestStatus.Pending;
    }

    /*Verifies that the given address has been accepted for the given patent*/
    function isAccepted(string memory _patentName, address _account) public view returns (bool){
        return patents[_patentName].requests[_account].status == RequestStatus.Accepted;
    }

    /*Returns true if account is owner of given patent*/
    function isOwner(string memory _patentName, address _account) public view returns (bool){
        return getPatentOwner(_patentName) == _account;
    }

    /*Returns time-stamp of the Patent*/
    function getTimeStamp(string memory _patentName) public view returns (uint){
        return patents[_patentName].timestamp;
    }

    /*Returns the sha256 hash of the patent*/
    function getPatentHash(string memory _patentName) public view returns (string memory){
        return patents[_patentName].patentHash;
    }

    /*Returns patent's owner*/
    function getPatentOwner(string memory _patentName) public view returns (address) {
        return patents[_patentName].owner;
    }

    /*Returns album's owner*/
    function getAlbumOwner(string memory _albumName) public view returns (address) {
        return albums[_albumName].patent.owner;
    }

    /*Returns the price of a patent*/
    function getPrice(string memory _patentName, uint _licence) public view returns (uint) {
        // index by licence-1 because licence 0 price not stored in licencePrices since free
        return patents[_patentName].licencePrices[_licence-1];
    }

    /*Returns the price of a patent*/
    function getPrices(string memory _patentName) public view returns (uint[] memory) {
        return patents[_patentName].licencePrices;
    }

    /*Returns the number of requests for the given patent*/
    function getNumRequests(string memory _patentName) public view returns (uint){
        return patents[_patentName].numRequests;
    }

    /*Returns the address of the buyer at _index  (Used for iterating)*/
    function getBuyers(string memory _patentName, uint _index) public view returns (address){
        return patents[_patentName].buyers[_index];
    }

    /*Returns the requester's public key*/
    function getEncryptionKey(string memory _patentName, address _user) public view returns (string memory){
        require(msg.sender == patents[_patentName].owner);
        return patents[_patentName].requests[_user].encryptionKey;
    }

    /*Returns the encrypted IPFS encryption key*/
    function getEncryptedIpfsKey(string memory _patentName) public view returns (string memory){
        require(isAccepted(_patentName, msg.sender));
        return patents[_patentName].requests[msg.sender].encryptedIpfsKey;
    }

    function getOwnerEmail(string memory _patentName) public view returns (string memory) {
        return patents[_patentName].email;
    }

    /*Returns the IPFS location of the patent*/
    function getPatentLocation(string memory _patentName) public view returns (string memory) {
        return patents[_patentName].ipfs;
    }

    function isRegistered(string memory _patentName) public view returns (bool) {
        return patents[_patentName].timestamp != 0;
    }

    /*Returns true if the patent has been deleted*/
    function isDeleted(string memory _patentName) public view returns (bool) {
        return patents[_patentName].deleted;
    }
}
