var BigNumber = require('bignumber.js');

const Will = artifacts.require("./Wills.sol");
const Token = artifacts.require('./ERC20.sol');
const MyBitBurner = artifacts.require('./MyBitBurner.sol');
const Database = artifacts.require('./Database.sol');
const ContractManager = artifacts.require('./ContractManager.sol');

const WEI = 1000000000000000000;
const deadline = 5;

const tokenSupply = 100000;
const tokenPerAccount = 1000;

let burnFee = 250;

contract('Will - Deploying and storing all contracts + validation', async (accounts) => {
  const owner = web3.eth.accounts[0];
  const recipient = web3.eth.accounts[1];

  let database;
  let contractManager;
  let token;
  let burner;
  let will;
  let id;
  let willExpiration;

  // Deploy token contract
  it ('Deploy MyBit Token contract', async() => {
    token = await Token.new(tokenSupply, "MyBit Token", 8, "MyB");
    tokenAddress = await token.address;
    console.log(tokenAddress);

    assert.equal(await token.totalSupply(), tokenSupply);
    assert.equal(await token.balanceOf(owner), tokenSupply);
  });

  // Give every user tokenPerAccount amount of tokens
  it("Spread tokens to users", async () => {
    for (var i = 1; i < web3.eth.accounts.length; i++) {
      //console.log(web3.eth.accounts[i]);
      await token.transfer(web3.eth.accounts[i], tokenPerAccount);
      let userBalance = await token.balanceOf(web3.eth.accounts[i]);
      assert.equal(userBalance, tokenPerAccount);
    }
    // Check token ledger is correct
    const totalTokensCirculating = (web3.eth.accounts.length - 1) * (tokenPerAccount);
    const remainingTokens = tokenSupply - totalTokensCirculating;
    assert.equal(await token.balanceOf(owner), remainingTokens);
  });

  it('Deploy Database', async() => {
    database = await Database.new(owner);
    contractManager = await ContractManager.new(database.address);
    await database.setContractManager(contractManager.address);
  });

  it ('Deploy MyBitBurner contract', async() => {
    burner = await MyBitBurner.new(tokenAddress);
  });

  it('Deploy Will contract', async() => {
    //will = await Will.new(recipient, deadline, {value: (5 * WEI) });
    will = await Will.new(database.address, burner.address);
    await contractManager.addContract('Will', will.address);
    await burner.authorizeBurner(will.address);
    let authTrue = await burner.authorizedBurner(will.address);
    assert.equal(true, authTrue);
  });

  it('Fail to change MyB Fee', async() => {
    try{
      await will.changeMYBFee(200, {from: recipient});
    }catch(e){
      console.log('Only owner can change MyB fee');
    }
  });

  it('Change MyB Fee', async() => {
    burnFee = 200;
    await will.changeMYBFee(burnFee);
  });

  it('Fail to create will', async() => {
    try{
      await will.createWill(recipient, 0, true, {value: (5 * WEI)});
    } catch(e){
      console.log('Cant have 0 blocks between proof');
    }
  });

  it('Fail to create will', async() => {
    try{
      await will.createWill('0', 5, true, {value: (5 * WEI)});
    } catch(e){
      console.log('Invalid recipient address');
    }
  });

  it('Create will', async() => {
    tx = await will.createWill(recipient, 5, true, {value: (5 * WEI)});
    //console.log(tx);
    id = tx.logs[0].args._id;
    //console.log(id)
    blockNumber = await web3.eth.getBlock('latest').number;

    willStruct = await will.getWill(id);
    willOwner = willStruct[0];
    willRecipient = willStruct[1];
    willAmount = willStruct[2].toNumber();
    willExpiration = willStruct[4].toNumber();

    assert.equal(owner, willOwner);
    assert.equal(recipient, willRecipient);
    assert.equal((5 * WEI), willAmount);
    assert.equal(blockNumber + 5, willExpiration);
  });

  it('Fail to revoke will', async() => {
    try{
      await will.revokeWill(id, {from: web3.eth.accounts[9]});
    } catch(e){
      console.log('Not owner');
    }
  });

  it('Revoke will', async() => {
    await will.revokeWill(id);
  });

  it('Create will', async() => {
    tx = await will.createWill(recipient, 5, true, {value: (5 * WEI)});
    //console.log(tx);
    id = tx.logs[0].args._id;
    //console.log(id)
    blockNumber = await web3.eth.getBlock('latest').number;

    willStruct = await will.getWill(id);
    willOwner = willStruct[0];
    willRecipient = willStruct[1];
    willAmount = willStruct[2].toNumber();
    willExpiration = willStruct[4].toNumber();

    assert.equal(owner, willOwner);
    assert.equal(recipient, willRecipient);
    assert.equal((5 * WEI), willAmount);
    assert.equal(blockNumber + 5, willExpiration);
  });

  it('Fail to create duplicate will', async() => {
    try{
      await will.createWill(recipient, 5, true, {value: (5 * WEI)});
    } catch(e){
      console.log('Will already created for that recipient');
    }
  });

  it('Prove existence', async() => {
    oldExpiration = willExpiration;
    console.log('Old Expiration: ' + oldExpiration);

    await will.proveExistence(id);

    blockNumber = await web3.eth.getBlock('latest').number;
    console.log('Block Number: ' + blockNumber);

    willStruct = await will.getWill(id)
    willExpiration = willStruct[4].toNumber();
    console.log('New Expiration: ' + willExpiration);

    assert.equal(oldExpiration + 5, willExpiration);
  });

  it('Spam proveExistence', async() => {
    try{
      await will.proveExistence(id);
      await will.proveExistence(id);
    } catch(e) {
      console.log('Already proved existence');
    }
  })

  it('Change Time Between Proofs', async() => {
    oldExpiration = willExpiration;
    console.log('Old Expiration: ' + oldExpiration);

    willStruct = await will.getWill(id)
    willBlocks = willStruct[3].toNumber();
    console.log('Blocks between proofs: ' + willBlocks);

    await will.changeBlocksBetweenProofs(id, 1);
    willStruct = await will.getWill(id);
    willBlocks = willStruct[3].toNumber();
    assert.equal(1, willBlocks);

    //await will.proveExistence(id);

    newExpiration = willStruct[4].toNumber();
    console.log('New Expiration: ' + newExpiration);

  });

  it('Fail to claim will', async() => {
    try{
      await will.claimWill(id, {from:recipient});
    } catch(e){
      console.log('Cannot claim will yet');
    }
  });

  it('Fail to claim will', async() => {
    try{
      await will.claimWill(id, {from:web3.eth.accounts[2]});
    } catch(e){
      console.log('This will aint for you');
    }
  });

  it('Progress expiration', async() => {
    blockNumber = await web3.eth.getBlock('latest').number;
    console.log('Block Number: ' + blockNumber);

    willStruct = await will.getWill(id);
    willExpiration = willStruct[4].toNumber();
    console.log('Will Expiration: ' + willExpiration);

    blockTillExpiration = willExpiration - blockNumber;

    for(i=0; i<blockTillExpiration; i++){
      //Need to progress the block number by blockTillExpiration
      await will.changeBlocksBetweenProofs(id, 1); //Should move up the block number without changing anything
      console.log('Count: ' + i);
    }
  });

  it('Fail to revoke will', async() => {
    try{
      await will.revokeWill(id);
    } catch(e){
      console.log('Past expiration');
    }
  });

  it('Claim will', async() => {
    willAmount = willStruct[2].toNumber();
    console.log('Will Amount: ' + willAmount);

    oldBalance = await web3.eth.getBalance(recipient);
    console.log('Old Balance: ' + oldBalance);

    //Need to switch account to recipient
    await will.claimWill(id, {from:recipient});

    newBalance = await web3.eth.getBalance(recipient);
    console.log('New Balance: ' + newBalance);

    assert.equal(BigNumber(oldBalance).lt(newBalance), true);
  });

  it('Create irrevocable will', async() => {
    tx = await will.createWill(recipient, 5, false, {value: (1 * WEI)});
    //console.log(tx);
    id = tx.logs[0].args._id;
  });

  it('Fail to revoke will', async() => {
    try{
      await will.revokeWill(id);
    } catch(e){
      console.log('Will is irrevocable');
    }
  });

  it('Fail to close contract', async() => {
    try {
      await will.closeContract({from: recipient});
    }catch(e) {
      console.log('Only owner may close contract')
    }
  });

  it('Close contract', async() => {
    await will.closeContract();
  });

  it('Fail to close factory', async() => {
    try {
      await will.closeContract();
    }catch(e) {
      console.log('Contract is already closed');
    }
  });

  it('Fail to deploy will', async() => {
    try{
      await will.createWill(recipient, 5, true, {value: (5 * WEI)});
    }catch(e){
      console.log('Contract is closed');
    }
  });
});
