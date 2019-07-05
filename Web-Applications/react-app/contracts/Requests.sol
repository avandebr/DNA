pragma solidity ^0.5.0;

import './AccessRestricted.sol';
import './Patents.sol';

contract Requests is AccessRestricted {

    // TODO: remove deposit ?
    // TODO: add text to require

    Patents patents;

    enum RequestStatus {NotRequested, Pending, Accepted, Rejected, Cancelled}

    /* Struct for request */
    struct Request {
        RequestStatus status;
        uint8 acceptedLicence;
        uint8 requestedLicence;
        uint deposit;
        string email;
        string encryptionKey;
        string encryptedIpfsKey;
    }

    // force requesters to also register and put in Users struct ?
    mapping(address => string[]) requestedPatentIDs; // requester to its requested patent IDs
    mapping(string => mapping(address => Request)) requests; // patentID to (userID => Request)

    event NewRequest(
        string _ownerMail,
        string _patentName,
        address _rentee
    );

    event RequestResponse(
        string _requesterEmail,
        string _patentName,
        bool _accepted
    );

    // ========================================= CONSTRUCTOR AND SETTERS ============================================

    /* Constructor of the contract
    * {param} uint : The price for depositing a pattern in Wei
    */
    constructor(address payable _patentsAddress) public {
        patents = Patents(_patentsAddress);
        // patents.setRequestsAddress(address(this));
    }

    /*Allows the contract owner to modify the address of the Patents Contract in case it would change*/
    function setPatentsAddress(uint _newAddress) public onlyOwner {
        patents = Patents(_newAddress);
    }

    // ========================================= REQUESTING FUNCTIONS ============================================

    /* Function to request access to a patent
    * {params} _patentName : name of patent
    *          _requestedLicence : licence requested for the patent
    *          _encryptionKey : key to encrypt AES key with (key exchange protocol)
    * {costs} price of the patent : will be frozen until request is accepted, rejected, or cancelled
    */
    function requestAccess(string memory _patentID, uint8 _requestedLicence, string memory _encryptionKey, string memory _email) public payable {
        require(patents.isRegistered(_patentID) && canRequest(_patentID, _requestedLicence, msg.sender));
        require(!hasRequested(_patentID, msg.sender));
        uint ethPrice = patents.getEthPrice(patents.getPrice(_patentID, _requestedLicence));
        require(msg.value >= ethPrice);
        requestedPatentIDs[msg.sender].push(_patentID);
        requests[_patentID][msg.sender] = Request(RequestStatus.Pending, 0, _requestedLicence, ethPrice, _email, _encryptionKey, "");
        patents.addBuyer(_patentID, msg.sender);
        emit NewRequest(patents.getOwnerEmail(_patentID), patents.getPatentName(_patentID), msg.sender); // put licence in event
    }

    /* Resend a request for a patent (either to upgrade licence for an accepted request or
    *  to request access for a previously rejected or cancelled request)
    */
    function resendRequest(string memory _patentID, uint8 _requestedLicence) public payable {
        require(patents.isRegistered(_patentID) && canRequest(_patentID, _requestedLicence, msg.sender));
        require(hasRequested(_patentID, msg.sender));
        uint price = patents.getPrice(_patentID, _requestedLicence);
        uint8 userLicence = requests[_patentID][msg.sender].acceptedLicence;
        if (userLicence > 0) {
            // just pay the difference if the user has already access to a licence
            price -= patents.getPrice(_patentID, userLicence);
        }
        uint ethPrice = patents.getEthPrice(price);
        require(msg.value >= ethPrice);
        Request storage r = requests[_patentID][msg.sender];
        r.status = RequestStatus.Pending;
        r.requestedLicence = _requestedLicence;
        r.deposit = ethPrice;
        emit NewRequest(patents.getOwnerEmail(_patentID), patents.getPatentName(_patentID), msg.sender); // put licence, owner name, in event and parameter isNew ?
    }

    /* Function to accept a request
    * {params} _patentID : id of patent
    *          _user : user to give access to (must have requested)
    *   Transfers the amount to the patent owner
    */
    function acceptRequest(string memory _patentID, address _user) public {
        require(patents.isRegistered(_patentID) && patents.isOwner(_patentID, msg.sender) && isPending(_patentID, _user));
        Request storage r = requests[_patentID][_user];
        // require(r.deposit >= 0);
        msg.sender.transfer(r.deposit);
        r.deposit = 0;
        r.status = RequestStatus.Accepted;
        r.acceptedLicence = r.requestedLicence;
        emit RequestResponse(r.email, patents.getPatentName(_patentID), true); // put licence in event
    }

    /* Function to grant access to a user
    * {params} _patentID : id of patent
    *          _user : user to give access to (must have requested)
    *          _encryptedIpfsKey : encrypted AES key to decrypt file on ipfs
    *   accept the pending request and gives the key to the requester
    */
    function grantAccess(string memory _patentID, address _user, string memory _encryptedIpfsKey) public {
        acceptRequest(_patentID, _user);
        Request storage r = requests[_patentID][_user];
        r.encryptedIpfsKey = _encryptedIpfsKey;
    }

    /* Function to reject access to a patent or a licence upgrade
    * {params} : Same as above
    * Refunds the amount to the user
    */
    function rejectRequest(string memory _patentID, address payable _user) public {
        require(patents.isRegistered(_patentID) && patents.isOwner(_patentID, msg.sender) && isPending(_patentID, _user));
        Request storage r = requests[_patentID][_user];
        require(r.deposit >= 0);
        // Refund back to user
        _user.transfer(r.deposit);
        r.deposit = 0;
        // if user already had access (i.e. asked for upgrade), just go back to previously accepted licence, otherwise reject
        uint8 userLicence = requests[_patentID][msg.sender].acceptedLicence;
        if (userLicence > 0) {
            r.status = RequestStatus.Accepted;
        } else {
            r.status = RequestStatus.Rejected;
        }
        emit RequestResponse(r.email, patents.getPatentName(_patentID), false); // Put licence in event
    }

    /* Function that cancels a request (can only be called by user)
    * {params} : _patentName : name of patent
    */
    function cancelRequest(string memory _patentID) public {
        require(patents.isRegistered(_patentID) && isPending(_patentID, msg.sender));
        Request storage r = requests[_patentID][msg.sender];
        require(r.deposit >= 0);
        // Refund back to user
        msg.sender.transfer(r.deposit);
        r.deposit = 0;
        uint8 userLicence = requests[_patentID][msg.sender].acceptedLicence;
        if (userLicence > 0) {
            r.status = RequestStatus.Accepted;
        } else {
            r.status = RequestStatus.Cancelled;
        }
    }

    /* ============================== View functions that do not require transactions ============================== */

    /*Returns true if the given account can request the given patent*/
    function canRequest(string memory _patentID, uint _requestedLicence, address _userID) public view returns (bool){
        return !patents.isDeleted(_patentID) && !isPending(_patentID, _userID) && !patents.isOwner(_patentID, _userID)
        && _requestedLicence > getAcceptedLicence(_patentID, _userID) && _requestedLicence <= patents.getMaxLicence(_patentID);
    }

    /*Returns the address of the buyer at _index  (Used for iterating)*/
    function getNumRequestedPatents(address _userID) public view returns (uint){
        return requestedPatentIDs[_userID].length;
    }

    /*Returns the requested patent ID of the _user at _index*/
    function getRequestedPatents(address _userID, uint _index) public view returns (string memory){
        return requestedPatentIDs[_userID][_index];
    }

    /*Returns the requested patent ID of the _user at _index*/
    function getRequestStatus(string memory _patentID, address _userID) public view returns (RequestStatus){
        return requests[_patentID][_userID].status;
    }

    /*Returns true of the given account has a pending request on the given patent*/
    function isPending(string memory _patentID, address _userID) public view returns (bool){
        return getRequestStatus(_patentID, _userID) == RequestStatus.Pending;
    }

    /*Returns true of the given account has a pending request on the given patent*/
    function isAccepted(string memory _patentID, address _userID) public view returns (bool){
        return getRequestStatus(_patentID, _userID) == RequestStatus.Accepted;
    }

    /* Returns the accepted licence of the given patent for the given account */
    function getAcceptedLicence(string memory _patentID, address _userID) public view returns (uint){
        return requests[_patentID][_userID].acceptedLicence;
    }

    /* Returns the accepted licence of the given patent for the given account */
    function getRequestedLicence(string memory _patentID, address _userID) public view returns (uint){
        return requests[_patentID][_userID].requestedLicence;
    }

    function hasRequested(string memory _patentID, address _userID) public view returns (bool) {
        return getRequestStatus(_patentID, _userID) != RequestStatus.NotRequested;
    }

    /*Returns the requester's public key*/
    function getEncryptionKey(string memory _patentID, address _userID) public view returns (string memory){
        return requests[_patentID][_userID].encryptionKey;
    }

    /*Returns the encrypted IPFS AES key*/
    function getEncryptedIpfsKey(string memory _patentID) public view returns (string memory){
        // require(getAcceptedLicence(_patentID, msg.sender) > 0);
        return requests[_patentID][msg.sender].encryptedIpfsKey;
    }
}
