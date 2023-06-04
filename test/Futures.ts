import { ethers, network } from 'hardhat';
import { Contract, Signer } from 'ethers';
import { expect } from 'chai';

import { config, SIDE } from "./config";

const { parseEther, parseUnits } = ethers.utils;

describe('Futures', () => {
  let userA: Signer, userB: Signer, bot: Signer;
  let betContract: Contract, usdcToken: Contract;

  const { tokenOwnerAddress, usdcTokenAddress, btcPriceOracle } = config

  /**
 * @dev Mint tokens to user addresses.
 */
  const mintTokens = async () => {
    // Get the signer for the token owner address
    const tokenOwnerSigner = await ethers.provider.getSigner(tokenOwnerAddress);

    // Impersonate the token owner account for token transfers
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [tokenOwnerAddress],
    });

    // Send Ether to the wallet for transaction fee
    const forceSendContract = await ethers.getContractFactory("ForceSend");
    const forceSend = await forceSendContract.deploy(); // Some contracts do not have receive(), so we force send
    await forceSend.deployed();
    await forceSend.go(tokenOwnerAddress, {
      value: parseEther("10"),
    });

    // Transfer USDC tokens to userA and userB
    await usdcToken
      .connect(tokenOwnerSigner)
      .transfer(userA.getAddress(), parseUnits("1000000", 6));
    await usdcToken
      .connect(tokenOwnerSigner)
      .transfer(userB.getAddress(), parseUnits("1000000", 6));

    // Stop impersonating the token owner account
    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [tokenOwnerAddress],
    });
  };


  /**
 * @dev Set up the test environment before each test.
 */
  beforeEach(async () => {
    // Get the list of signers
    const accounts = await ethers.getSigners();
    userA = accounts[0];
    userB = accounts[1];
    bot = accounts[2];

    // Deploy the smart contract
    const BetContract = await ethers.getContractFactory('Futures');
    betContract = await BetContract.deploy(usdcTokenAddress, btcPriceOracle);

    // Get the USDC token contract instance
    usdcToken = await ethers.getContractAt('IERC20', usdcTokenAddress);

    // Mint tokens and distribute to userA and userB
    await mintTokens();

    // Approve the bet contract to spend user's USDC tokens
    await usdcToken.connect(userA).approve(betContract.address, ethers.constants.MaxUint256);
    await usdcToken.connect(userB).approve(betContract.address, ethers.constants.MaxUint256);
  });


  it('should allow User A to open a pending bet', async () => {
    // User A opens a pending bet
    const side = SIDE.LONG;
    const betAmount = parseUnits("100", 6);
    const expirationTime = Math.floor(Date.now() / 1000) + 60; // 1 minute from now
    const closingTime = expirationTime + 300; // 5 minutes from now

    await expect(betContract.connect(userA).openBet(side, betAmount, expirationTime, closingTime))
      .to.emit(betContract, 'BetOpened')
      .withArgs(0, await userA.getAddress(), side, betAmount, expirationTime, closingTime);
  });

  it('should allow User B to join a pending bet and make it active', async () => {
    // User A opens a pending bet
    const side = SIDE.LONG;
    const betAmount = parseUnits("100", 6);
    const expirationTime = Math.floor(Date.now() / 1000) + 60; // 1 minute from now
    const closingTime = expirationTime + 300; // 5 minutes from now

    await betContract.connect(userA).openBet(side, betAmount, expirationTime, closingTime);

    // User B joins the pending bet
    await expect(betContract.connect(userB).joinBet(0))
      .to.emit(betContract, 'BetJoined')
      .withArgs(0, await userB.getAddress());
  });

  it('should fetch the opening price and determine the winner on bet closure', async () => {
    // User A opens a pending bet
    const side = SIDE.LONG;
    const betAmount = parseUnits("100", 6);
    const expirationTime = Math.floor(Date.now() / 1000) + 60; // 1 minute from now
    const closingTime = expirationTime + 300; // 5 minutes from now

    await betContract.connect(userA).openBet(side, betAmount, expirationTime, closingTime);

    // User B joins the pending bet
    await betContract.connect(userB).joinBet(0);

    // Simulate the closing time
    await ethers.provider.send('evm_setNextBlockTimestamp', [closingTime]);
    await ethers.provider.send('evm_mine', []);

    // Get balances of userA and the bot before closing the bet
    const userABalanceBefore = await usdcToken.balanceOf(userA.getAddress());
    const botBalanceBefore = await usdcToken.balanceOf(bot.getAddress());

    // Close the bet
    await expect(betContract.connect(bot).closeBet(0))
      .to.emit(betContract, 'BetClosed')
      .withArgs(0, await userA.getAddress()); // User A wins with a 1% fee deducted

    // Get balances of userA and the bot after closing the bet and
    // verify the winner and fee transfer
    const userABalanceAfter = await usdcToken.balanceOf(userA.getAddress());
    const botBalanceAfgter = await usdcToken.balanceOf(bot.getAddress());

    expect(userABalanceAfter.sub(userABalanceBefore)).to.equal(betAmount.mul(2).mul(99).div(100)); // User A receives the winnings
    expect(botBalanceAfgter.sub(botBalanceBefore)).to.equal(betAmount.mul(2).mul(1).div(100));
  });

  it('should revert if a bet is not joined before expiration time', async () => {
    // User A opens a pending bet
    const side = SIDE.LONG;
    const betAmount = parseUnits("100", 6);
    const expirationTime = Math.floor(Date.now() / 1000) + 60; // 1 minute from now
    const closingTime = expirationTime + 300; // 5 minutes from now

    await betContract.connect(userA).openBet(side, betAmount, expirationTime, closingTime);

    // Simulate the expiration time
    await ethers.provider.send('evm_setNextBlockTimestamp', [closingTime + 300]);
    await ethers.provider.send('evm_mine', []);


    // User B unable to join the pending bet
    await expect(betContract.connect(userB).joinBet(0)).to.be.revertedWith('Bet has expired');

  });

});
