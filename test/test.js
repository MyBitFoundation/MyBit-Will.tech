var BigNumber = require('bignumber.js');

const Will = artifacts.require("./Wills.sol");
const Token = artifacts.require('./ERC20.sol');
const MyBitBurner = artifacts.require('./MyBitBurner.sol');
const Database = artifacts.require('./Database.sol');
const ContractManager = artifacts.require('./ContractManager.sol');

const WEI = 1000000000000000000;
const deadline = 5;

const tokenSupply = 1000000*WEI;
const tokenPerAccount = 10000*WEI;

let burnFee = 250*WEI;

contract('Will - Deploying and storing all contracts + validation', async (accounts) => {
  const owner = web3.eth.accounts[0];
  const recipient = web3.eth.accounts[1];

  let database;
  let contractManager;
  let token;
  let burner;
  let will;
  let id;
  let ercId;
  let willExpiration;
  let tx;

  // Deploy token contract
  it ('Deploy MyBit Token contract', async() => {
    token = await Token.new(tokenSupply, "MyBit Token", 8, "MyB");
    tokenAddress = await token.address;
    console.log(tokenAddress);

    assert.equal(await token.totalSupply(), tokenSupply);
    assert.equal(await token.balanceOf(owner), tokenSupply);
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
      await token.approve(burner.address, burnFee);
      await will.createWill(recipient, 0, true, {value: (5 * WEI)});
    } catch(e){
      console.log('Cant have 0 seconds between proof');
    }
  });

  it('Fail to create will', async() => {
    try{
      await token.approve(burner.address, burnFee);
      const willAddress = await will.address;
      await token.approve(will.address, 5 * WEI);
      const tokenAddress = await token.address;
      await will.createERC20Will('0', 1000, true, tokenAddress, 5 * WEI);
    } catch(e){
      console.log('Invalid recipient address');
    }
  });

  it('Fail to create erc20 will', async() => {
    try{
      await token.approve(burner.address, burnFee);
      const willAddress = await will.address;
      await token.approve(will.address, 5 * WEI);
      const tokenAddress = await token.address;
      await will.createERC20Will('0', 1000, true, tokenAddress, 5 * WEI);
    } catch(e){
      console.log('Invalid recipient address');
    }
  });

  it('Fail to create erc20 will', async() => {
    try{
      await token.approve(burner.address, burnFee);
      const willAddress = await will.address;
      await token.approve(will.address, 5 * WEI);
      const tokenAddress = await token.address;
      await will.createERC20Will(recipient, 0, true, tokenAddress, 5 * WEI);
    } catch(e){
      console.log('Cant have 0 seconds between proof');
    }
  });

  it('Fail to create erc20 will', async() => {
    try{
      await token.approve(burner.address, burnFee);
      const willAddress = await will.address;
      await token.approve(will.address, 5 * WEI);
      await will.createERC20Will(recipient, 1000, true, '0', 5 * WEI);
    } catch(e){
      console.log('Invalid token address');
    }
  });
  
  it('Create erc20 will', async() => {
    await token.approve(burner.address, burnFee);
    const willAddress = await will.address;
    await token.approve(will.address, 5 * WEI);
    const tokenAddress = await token.address;
    tx = await will.createERC20Will(recipient, 1000, true, tokenAddress, 5 * WEI);
    //console.log(tx);
    ercId = tx.logs[0].args._id;
    //console.log(id)
    now = await web3.eth.getBlock('latest').timestamp;

    willStruct = await will.getWill(ercId);
    willOwner = willStruct[0];
    willRecipient = willStruct[1];
    willAmount = willStruct[2].toNumber();
    willExpiration = willStruct[4].toNumber();
    willTokenAddress = willStruct[6];

    assert.equal(owner, willOwner);
    assert.equal(recipient, willRecipient);
    assert.equal((5 * WEI), willAmount);
    assert.equal(now + 1000, willExpiration);
    assert.equal(token.address, willTokenAddress);
  });

  it('Fail to create same erc20 will', async() => {
    try{
      await token.approve(burner.address, burnFee);
      const willAddress = await will.address;
      await token.approve(will.address, 5 * WEI);
      tx = await will.createERC20Will(recipient, 1000, true, tokenAddress, 5 * WEI);
    } catch(e){
      console.log('Will is already created');
    }
  });

  it('Create will', async() => {
    await token.approve(burner.address, burnFee);
    tx = await will.createWill(recipient, 5, true, {value: (5 * WEI)});
    //console.log(tx);
    id = tx.logs[0].args._id;
    //console.log(id)
    now = await web3.eth.getBlock('latest').timestamp;

    willStruct = await will.getWill(id);
    willOwner = willStruct[0];
    willRecipient = willStruct[1];
    willAmount = willStruct[2].toNumber();
    willExpiration = willStruct[4].toNumber();

    assert.equal(owner, willOwner);
    assert.equal(recipient, willRecipient);
    assert.equal((5 * WEI), willAmount);
    assert.equal(now + 5, willExpiration);
  });

  it('Fail to create same will', async() => {
    try{
      await token.approve(burner.address, burnFee);
      tx = await will.createWill(recipient, 5, true, {value: (5 * WEI)});
    } catch(e){
      console.log('Will is already created');
    }
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

  it('Revoke will erc20', async() => {
    await will.revokeWill(ercId);
  });

  it('Create erc20 will', async() => {
    await token.approve(burner.address, burnFee);
    const willAddress = await will.address;
    await token.approve(will.address, 5 * WEI);
    const tokenAddress = await token.address;
    tx = await will.createERC20Will(recipient, 1000, true, tokenAddress, 5 * WEI);
    //console.log(tx);
    ercId = tx.logs[0].args._id;
    //console.log(id)
    now = await web3.eth.getBlock('latest').timestamp;

    willStruct = await will.getWill(ercId);
    willOwner = willStruct[0];
    willRecipient = willStruct[1];
    willAmount = willStruct[2].toNumber();
    willExpiration = willStruct[4].toNumber();
    willTokenAddress = willStruct[6];

    assert.equal(owner, willOwner);
    assert.equal(recipient, willRecipient);
    assert.equal((5 * WEI), willAmount);
    assert.equal(now + 1000, willExpiration);
    assert.equal(token.address, willTokenAddress);
  });

  it('Create will', async() => {
    await token.approve(burner.address, burnFee);
    tx = await will.createWill(recipient, 1000, true, {value: (5 * WEI)});
    //console.log(tx);
    id = tx.logs[0].args._id;
    //console.log(id)
    now = await web3.eth.getBlock('latest').timestamp;

    willStruct = await will.getWill(id);
    willOwner = willStruct[0];
    willRecipient = willStruct[1];
    willAmount = willStruct[2].toNumber();
    willExpiration = willStruct[4].toNumber();

    assert.equal(owner, willOwner);
    assert.equal(recipient, willRecipient);
    assert.equal((5 * WEI), willAmount);
    assert.equal(now + 1000, willExpiration);
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

    //Advance time
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [500], id: 0
    }, function(){
      console.log('Move forward in time');
    });

    await will.proveExistence(id);

    now = await web3.eth.getBlock('latest').timestamp;
    console.log('Time: ' + now);

    willStruct = await will.getWill(id)
    willExpiration = willStruct[4].toNumber();
    console.log('New Expiration: ' + willExpiration);

    assert.equal(oldExpiration + 1000, willExpiration);
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
    willSec = willStruct[3].toNumber();
    console.log('Sec between proofs: ' + willSec);

    await will.changeSecBetweenProofs(id, 1);
    willStruct = await will.getWill(id);
    willSec = willStruct[3].toNumber();
    assert.equal(1, willSec);

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
    now = await web3.eth.getBlock('latest').timestamp;
    console.log('Time: ' + now);

    willStruct = await will.getWill(id);
    willExpiration = willStruct[4].toNumber();
    console.log('Will Expiration: ' + willExpiration);

    timeTillExpiration = willExpiration - now;
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [timeTillExpiration], id: 0
    }, function(){
      console.log('Move forward in time');
    });
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

  it('Claim erc20 will', async() => {
    ercWillStruct = await will.getWill(ercId);
    willAmount = willStruct[2].toNumber();
    console.log('Will Amount: ' + willAmount);

    oldBalance = await token.balanceOf(recipient);
    console.log('Old Balance: ' + oldBalance);

    //Need to switch account to recipient
    await will.claimWill(ercId, {from:recipient});

    newBalance = await token.balanceOf(recipient);
    console.log('New Balance: ' + newBalance);

    assert.equal(BigNumber(oldBalance).lt(newBalance), true);
  });

  it('Create irrevocable will', async() => {
    await token.approve(burner.address, burnFee);
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

  it('Fail to close contract', async() => {
    try {
      await will.closeContract();
    }catch(e) {
      console.log('Contract is already closed');
    }
  });

  it('Fail to deploy will', async() => {
    try{
      await token.approve(burner.address, burnFee);
      await will.createWill(recipient, 5, true, {value: (5 * WEI)});
    }catch(e){
      console.log('Contract is closed');
    }
  });
});
