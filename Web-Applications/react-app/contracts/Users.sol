pragma solidity ^0.5.0;

contract Users {

    // TODO: add text to require

    /* Struct for user account */
    struct User {
        string name;
        string email;
        uint createdAt;
        string[] ownedPatentIDs;
        string[] ownedFolderIDs;
    }

    address[] public userIDs; // user addresses
    mapping(address => User) private users; // user ID (address) to User

    /* Function to register a new user */
    function registerAccount(string memory _name, string memory _email) public {
        require(!isRegistered(msg.sender));
        users[msg.sender] = User(_name, _email, now, new string[](0), new string[](0));
        userIDs.push(msg.sender);
        // emit newAccount
    }

    /* Function to modify the user information */
    function modifyAccount(string memory _newName, string memory _newEmail) public {
        require(isRegistered(msg.sender) && (!equalStrings(_newName, users[msg.sender].name) || !equalStrings(_newEmail, users[msg.sender].email)));
        User storage u = users[msg.sender];
        u.name = _newName;
        u.email = _newEmail;
    }

    function addPatent(address _userID, string memory _patentID) public {
        User storage u = users[_userID];
        u.ownedPatentIDs.push(_patentID);
    }

    function addFolder(address _userID, string memory _folderID) public {
        User storage u = users[_userID];
        u.ownedFolderIDs.push(_folderID);
    }

    /*Returns the name of the _userID*/
    function getName(address _userID) public view returns (string memory) {
        return users[_userID].name;
    }

    /*Returns the email address of the _userID*/
    function getEmail(address _userID) public view returns (string memory) {
        return users[_userID].email;
    }

    /*Returns true if the given account has already been registered*/
    function isRegistered(address _userID) public view returns (bool) {
        return users[_userID].createdAt != 0;
    }

    /*Returns the number of patents owned by the user*/
    function getNumPatents(address _userID) public view returns (uint){
        return users[_userID].ownedPatentIDs.length;
    }

    /*Returns the patent of the _user at index i (Used for iterating)*/
    function getOwnedPatentIDs(address _userID, uint _index) public view returns (string memory){
        return users[_userID].ownedPatentIDs[_index];
    }

    /*Returns the number of folders owned by the user*/
    function getNumFolders(address _userID) public view returns (uint){
        return users[_userID].ownedFolderIDs.length;
    }

    /*Returns the folder of the _user at index i (Used for iterating)*/
    function getOwnedFolderIDs(address _userID, uint _index) public view returns (string memory){
        return users[_userID].ownedFolderIDs[_index];
    }

    function equalStrings(string memory a, string memory b) public pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))) );
    }
}
