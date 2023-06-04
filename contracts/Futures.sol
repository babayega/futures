// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title Futures Contract
 * @dev A smart contract for opening and closing futures bets.
 */
contract Futures {
    //
    // MODIFIERS
    //
    modifier nonReentrant() {
        require(entered == false, "Futures: reentrant call");
        entered = true;
        _;
        entered = false;
    }

    //
    // Enums
    //

    enum Side {
        Long,
        Short
    }

    //
    // Structs
    //
    struct Bet {
        address userA;
        address userB;
        Side side;
        uint256 betAmount;
        uint256 expirationTime;
        uint256 closingTime;
        bool active;
        int256 openingPrice;
        address winner;
    }

    //
    // Constants
    //
    uint256 internal constant FEE_MULTIPLIER = 100; // 1%

    //
    // Storage
    //

    /// @notice Bool to identify whether the function is already entered
    bool private entered = false;

    /// @notice Price feed for the underlying asset
    AggregatorV3Interface private priceFeed;

    /// @notice Mapping for all the bets placed
    mapping(uint256 => Bet) public bets;

    /// @notice Counter to generate betId
    uint256 public betCount;

    /// @notice Address of USDC token
    IERC20 public usdcToken;

    /// @notice Mapping to keep track of pending bet amounts
    mapping(uint256 => uint256) public pendingBetAmounts;

    //
    // Events
    //

    event BetOpened(
        uint256 indexed betId,
        address indexed userA,
        Side side,
        uint256 betAmount,
        uint256 expirationTime,
        uint256 closingTime
    );
    event BetJoined(uint256 indexed betId, address indexed userB);
    event BetClosed(uint256 indexed betId, address indexed winner);

    /**
     * @dev Contract constructor
     * @param _usdcTokenAddress The address of the USDC token contract
     * @param _priceFeedAddress The address of the price feed contract
     */
    constructor(address _usdcTokenAddress, address _priceFeedAddress) {
        usdcToken = IERC20(_usdcTokenAddress);
        priceFeed = AggregatorV3Interface(_priceFeedAddress);
    }

    /**
     * @dev Opens a new bet.
     * @param side The side of the bet (Long or Short)
     * @param betAmount The amount of the bet in USDC tokens
     * @param expirationTime The expiration time of the bet
     * @param closingTime The closing time of the bet
     */
    function openBet(
        Side side,
        uint256 betAmount,
        uint256 expirationTime,
        uint256 closingTime
    ) external {
        require(
            usdcToken.transferFrom(msg.sender, address(this), betAmount),
            "Failed to transfer USDC"
        );

        // Create a new Bet instance
        Bet storage newBet = bets[betCount];

        // Set the bet details
        newBet.userA = msg.sender;
        newBet.side = side;
        newBet.betAmount = betAmount;
        newBet.expirationTime = expirationTime;
        newBet.closingTime = closingTime;

        // Store the bet amount as pending
        pendingBetAmounts[betCount] = betAmount;

        // Emit the BetOpened event
        emit BetOpened(
            betCount,
            msg.sender,
            side,
            betAmount,
            expirationTime,
            closingTime
        );

        // Increment the betCount for the next bet
        betCount++;
    }

    /**
     * @dev Joins an existing bet.
     * @param betId The ID of the bet to join
     */
    function joinBet(uint256 betId) external {
        require(betId < betCount, "Invalid bet ID");
        require(
            block.timestamp < bets[betId].expirationTime,
            "Bet has expired"
        );
        require(!bets[betId].active, "Bet already active");
        require(
            msg.sender != bets[betId].userA,
            "You cannot join your own bet"
        );
        require(pendingBetAmounts[betId] > 0, "Bet no longer available");

        // Get the pending bet amount
        uint256 betAmount = pendingBetAmounts[betId];

        // Transfer the bet amount from the user's account to the contract
        require(
            usdcToken.transferFrom(msg.sender, address(this), betAmount),
            "Failed to transfer USDC"
        );

        // Update the bet details
        Bet storage selectedBet = bets[betId];
        selectedBet.userB = msg.sender;
        selectedBet.active = true;
        selectedBet.openingPrice = getPrice();

        // Set the pending bet amount to 0
        pendingBetAmounts[betId] = 0;

        // Emit the BetJoined event
        emit BetJoined(betId, msg.sender);
    }

    /**
     * @dev Closes an active bet.
     * @param betId The ID of the bet to close
     */
    function closeBet(uint256 betId) external nonReentrant {
        require(betId < betCount, "Invalid bet ID");
        require(bets[betId].active, "Bet not active");
        require(
            block.timestamp >= bets[betId].closingTime,
            "Bet not yet closed"
        );

        // Get the closed bet details
        Bet storage closedBet = bets[betId];
        closedBet.active = false;

        // Get the current price
        int256 currentPrice = getPrice();

        // Evaluate the bet conditions to determine the winner
        if (closedBet.side == Side.Long) {
            if (currentPrice >= closedBet.openingPrice) {
                closedBet.winner = closedBet.userA;
            } else {
                closedBet.winner = closedBet.userB;
            }
        } else {
            if (currentPrice < closedBet.openingPrice) {
                closedBet.winner = closedBet.userA;
            } else {
                closedBet.winner = closedBet.userB;
            }
        }

        // Calculate the total bet amount and the fee to the bot
        uint256 totalBetAmount = closedBet.betAmount * 2;
        uint256 feeToBot = totalBetAmount / FEE_MULTIPLIER;

        // Calculate the winnings for the winner
        uint256 winnings = totalBetAmount - feeToBot;

        // Transfer the fee to the bot's account
        usdcToken.transfer(msg.sender, feeToBot);

        // Transfer the winnings to the winner
        require(
            usdcToken.transfer(closedBet.winner, winnings),
            "Failed to transfer USDC"
        );

        // Emit the BetClosed event
        emit BetClosed(betId, closedBet.winner);
    }

    /**
     * @dev Internal function to get the current price from the price feed.
     * @return The current price as an int256 value.
     */
    function getPrice() internal view returns (int256) {
        // Get latest round data from the price feed
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return price;
    }
}
