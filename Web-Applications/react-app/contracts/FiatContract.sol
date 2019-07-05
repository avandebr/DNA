pragma solidity ^0.5.0;

contract FiatContract {

    function ETH(uint _id) view public returns (uint256);
    function USD(uint _id) view public returns (uint256);
    function EUR(uint _id) view public returns (uint256);
    function GBP(uint _id) view public returns (uint256);
    function updatedAt(uint _id) public view returns (uint);
}
