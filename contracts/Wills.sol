pragma solidity ^0.4.24;

import './SafeMath.sol';
import './Database.sol';
import './MyBitBurner.sol';

// @notice This contract allows someone to leave ETH for another user in the case that they become unresponsive for x blocks
// TODO: can structure this to have the recipient claim creators death, which starts the proofExpiration. Problem with this approach is that we need a good way to notify the creator.
contract Wills {
  using SafeMath for uint;

  Database public database;
  MyBitBurner public mybBurner;
  address public owner;

  uint public mybFee = 250;
  bool public expired = false;

  constructor(address _database, address _mybTokenBurner) public{
    owner = msg.sender;
    database = Database(_database);
    mybBurner = MyBitBurner(_mybTokenBurner);
  }

  function createWill(address _recipient, uint _blocksBetweenProofs, bool _revokeable)
  external
  payable
  notZero(_blocksBetweenProofs)
  validAddress(_recipient)
  returns (bytes32 id) {
    require(!expired);
    require(mybBurner.burn(msg.sender, mybFee));
    //Test whether will exists
    id = keccak256(abi.encodePacked(msg.sender, _recipient, msg.value));  // Note user cannot create another will with the same amount + recipient
    require(database.addressStorage(keccak256(abi.encodePacked('willCreator', id))) == address(0));   // Make sure struct isn't already created

    database.setAddress(keccak256(abi.encodePacked('willCreator', id)), msg.sender);
    database.setAddress(keccak256(abi.encodePacked('willRecipient', id)), _recipient);
    database.setUint(keccak256(abi.encodePacked('willAmount', id)), msg.value);
    database.setUint(keccak256(abi.encodePacked('willBlocksBetweenProofs', id)), _blocksBetweenProofs);
    database.setUint(keccak256(abi.encodePacked('willProofExpiration', id)), _blocksBetweenProofs.add(block.number));
    database.setBool(keccak256(abi.encodePacked('willRevokeable', id)), _revokeable);

    emit LogWillCreated(msg.sender, _recipient, msg.value, id);
    return id;
  }

  function proveExistence(bytes32 _id)
  external
  onlyCaller( database.addressStorage(keccak256(abi.encodePacked('willCreator', _id))) ){
    require( database.uintStorage(keccak256(abi.encodePacked('willProofExpiration', _id))).sub(block.number) < database.uintStorage(keccak256(abi.encodePacked('willBlocksBetweenProofs', _id))) );  // Can only extend proofExpiration once
    database.setUint(keccak256(abi.encodePacked('willProofExpiration', _id)), database.uintStorage(keccak256(abi.encodePacked('willProofExpiration', _id))).add( database.uintStorage(keccak256(abi.encodePacked('willBlocksBetweenProofs', _id))) ) );
  }

  function revokeWill(bytes32 _id)
  external
  isRevokeable(_id)
  onlyCaller( database.addressStorage(keccak256(abi.encodePacked('willCreator', _id))) ){
    require( block.number < database.uintStorage(keccak256(abi.encodePacked('willProofExpiration', _id))) );
    uint amountWEI = database.uintStorage(keccak256(abi.encodePacked('willAmount', _id)));
    database.deleteAddress(keccak256(abi.encodePacked('willCreator', _id)));
    database.deleteAddress(keccak256(abi.encodePacked('willRecipient', _id)));
    database.deleteUint(keccak256(abi.encodePacked('willAmount', _id)));
    database.deleteUint(keccak256(abi.encodePacked('willBlocksBetweenProofs', _id)));
    database.deleteUint(keccak256(abi.encodePacked('willProofExpiration', _id)));
    database.deleteBool(keccak256(abi.encodePacked('willRevokeable', _id)));
    msg.sender.transfer(amountWEI);
    emit LogWillRevoked(_id, msg.sender, amountWEI);
  }

  function claimWill(bytes32 _id)
  external
  onlyCaller( database.addressStorage(keccak256(abi.encodePacked('willRecipient', _id))) ){
    require( block.number >= database.uintStorage(keccak256(abi.encodePacked('willProofExpiration', _id))) );
    uint amountWEI = database.uintStorage(keccak256(abi.encodePacked('willAmount', _id)));
    database.deleteAddress(keccak256(abi.encodePacked('willCreator', _id)));
    database.deleteAddress(keccak256(abi.encodePacked('willRecipient', _id)));
    database.deleteUint(keccak256(abi.encodePacked('willAmount', _id)));
    database.deleteUint(keccak256(abi.encodePacked('willBlocksBetweenProofs', _id)));
    database.deleteUint(keccak256(abi.encodePacked('willProofExpiration', _id)));
    database.deleteBool(keccak256(abi.encodePacked('willRevokeable', _id)));
    msg.sender.transfer(amountWEI);
    emit LogWillClaimed(_id, msg.sender, amountWEI);
  }


  function changeBlocksBetweenProofs(bytes32 _id, uint _newDesiredBlocks)
  external
  onlyCaller( database.addressStorage(keccak256(abi.encodePacked('willCreator', _id))) )
  notZero(_newDesiredBlocks) {
      database.setUint(keccak256(abi.encodePacked('willBlocksBetweenProofs', _id)), _newDesiredBlocks);

  }

  // @notice If called by owner, this function prevents more Trust contracts from being made once
  // @notice Old contracts will continue to function
  function closeContract()
  external {
    require(msg.sender == owner);
    require (!expired);
    expired = true;
  }

  function changeMYBFee(uint _newFee)
  external {
    require(msg.sender == owner);
    mybFee = _newFee;
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //                                            View functions
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  function getWill(bytes32 _id)
  external
  view
  returns (address, address, uint, uint, uint, bool) {
    return(
      database.addressStorage(keccak256(abi.encodePacked('willCreator', _id))),
      database.addressStorage(keccak256(abi.encodePacked('willRecipient', _id))),
      database.uintStorage(keccak256(abi.encodePacked('willAmount', _id))),
      database.uintStorage(keccak256(abi.encodePacked('willBlocksBetweenProofs', _id))),
      database.uintStorage(keccak256(abi.encodePacked('willProofExpiration', _id))),
      database.boolStorage(keccak256(abi.encodePacked('willRevokeable', _id)))
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //                                            Modifiers
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @notice reverts if msg.sender isn't the specified caller
  modifier onlyCaller(address _caller) {
    require(msg.sender == _caller);
    _;
  }

  // @notice reverts if will is not revokeable
  modifier isRevokeable(bytes32 _id) {
    require(database.boolStorage(keccak256(abi.encodePacked('willRevokeable', _id))));
    _;
  }

  // @notice reverts if integer is 0
  modifier notZero(uint _number) {
    require(_number > 0);
    _;
  }

  modifier validAddress(address _addr) {
    require(_addr != address(0));
    _;
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //                                            Events
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  event LogWillCreated(address indexed _creator, address _recipient, uint _amount, bytes32 _id);
  event LogWillClaimed(bytes32 indexed _id, address _recipient, uint _amount);
  event LogWillRevoked(bytes32 indexed _id, address _recipient, uint _amount);

}
