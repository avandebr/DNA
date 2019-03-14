pragma solidity ^0.5.0;

import './AccessRestricted.sol';
import './FiatContract.sol';

contract TimeStamping is AccessRestricted {

    struct Stamp {
        address user;
        uint timestamp;
    }

    mapping(string => Stamp) timestamps;
    uint public price;

    uint public stampCount;

    // FiatContract public fiat;

    constructor(uint _price, address _fiatContract) public {
        price = _price;
        // fiat = FiatContract(_fiatContract);
        stampCount = 0;
    }

    //Withdraw funds only by owner
    function withdrawFunds() public onlyOwner {
        owner.transfer(address(this).balance);
    }

    //For simple donations
    function () external payable {

    }

    /*Returns price */
    function getEthPrice() public view returns (uint){
        // return fiat.USD(0) * 100 * price;
        return price / 130;
    }

    //Stamp a hash, costs a certain amount (for precise time stamping)
    function stamp(string memory _hash) public payable{
        require(msg.sender != owner && msg.value >= getEthPrice());
        stampHash(_hash, msg.sender);
    }

    //Owner stamp, usually used to timestamp the root of a merkle tree
    function ownerStamp(string memory _hash) public payable onlyOwner {
        stampHash(_hash, msg.sender);
    }

    //Helper function to stamp hash for a certain user
    function stampHash(string memory _hash, address user) private {
        require(timestamps[_hash].timestamp == 0);
        timestamps[_hash] = Stamp(user, now);
        stampCount++;
    }

    //Return the timestamp of a given hash or 0 if non existent
    function getTimestamp(string memory _hash) public view returns (uint){
        return timestamps[_hash].timestamp;
    }

    //Get the user linked to a hash or 0 if non existent
    function getUser(string memory _hash) public view returns (address){
        return timestamps[_hash].user;
    }
}
