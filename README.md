# Futures Protocol

This project implements a simple protocol for placing bets on the future price of Bitcoin using a smart contract. It consists of a Solidity smart contract written in Ethereum's Solidity language, backend code written in TypeScript with Ethers.js, and a bot that monitors active bets and closes them at expiry.

## Smart Contract

The smart contract is implemented in Solidity and allows users to open pending bets and join existing bets. Key features of the smart contract include:

- Opening a pending bet with side (long/short), bet amount in USDC, expiration time, and closing time.
- Joining a pending bet by depositing an identical amount into the escrow smart contract.
- Fetching the opening price and determining the winner once the bet is closed.
- Transferring the winning amount to the winner after deducting a fee for the closing bot.

Please refer to the `contracts/Futures.sol` file for the detailed implementation of the smart contract.

## Backend Code

The backend code is written in TypeScript and uses the Ethers.js library to interact with the smart contract. It provides the following functionalities:

- Connecting to an Ethereum provider using the Ethers.js library.
- Making a WebSocket connection to the smart contract to track all pending, active, and closed bets.
- Storing the relevant smart contract events in a local database to keep track of the betting activities.

Please refer to the `scripts/events.ts` file for the detailed implementation of the backend code.

## Bot

The bot is implemented as a TypeScript script that monitors active bets stored in the local database and requests the betting contract to close the bet and select the winner. The bot is rewarded with a small fee collected on the betting amount. Key features of the bot include:

- Connecting to a local SQLite database using the `sqlite` package.
- Monitoring active bets by querying the database for their closing time.
- Requesting the smart contract to close the bet and determining the winner once the bet reaches its closing time.
- Collecting a small fee as a reward for its services.

Please refer to the `scripts/bot.ts` file for the detailed implementation of the bot.

## Getting Started

To run the project, follow these steps:

1. Install the necessary dependencies by running `npm install` or `yarn install`.
2. Run the test cases by running `npm run test`.
3. Deploy the smart contract to an Ethereum network or a locally cloned network.
4. Update the configuration in the backend code and bot script with the relevant contract addresses, Ethereum provider URL, and private keys.
5. Run the backend code using `npm run events` or `yarn events`.
6. Run the bot script using `npm run bot` or `yarn bot`.

Make sure to replace any placeholder values like `<web3_provider_url>`, `<bet_contract_address>`, `<bot_private_key>`, `<usdc_token_address>`, and `<path_to_abi>` with the actual values based on your deployment and setup.

## Enhancements

The following changes will make the system more robust and resilient:

1. **Separate Indexer Service**: Implement a separate indexer service to efficiently store the events from the smart contract. This approach enhances fault tolerance and allows for easier retrieval of historical data. The indexer can also push all joined bets to a queue or long polling system, along with their closing times, enabling efficient task management.

2. **Closing Bot Architecture**: Architect the closing bot to receive tasks from the queue that have closed or are about to be closed. By decoupling the closing bot from the main system, it can handle closing tasks independently and efficiently. This approach improves scalability and enables better management of the closing process.

3. **Enhanced Oracle System**: Improve the oracle system in the smart contract to provide more accurate prices at the exact closing times of the bets. This can be achieved by implementing a service that fetches the prices from the oracle at the closing times beforehand. By incorporating real-time or near-real-time data, the accuracy of winner declaration is increased, resulting in a more reliable and fair betting system.

These enhancements will contribute to the overall robustness, resilience, and accuracy of the betting system.