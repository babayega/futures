import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";

import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        runs: 200,
        enabled: true,
      },
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: false,
      chainId: 1,
      blockGasLimit: 8e6,
      forking: {
        enabled: true,
        url: 'https://rpc.ankr.com/eth',
        blockNumber: 17399040,
      },
    },
  },
  paths: {
    deploy: "scripts/deploy",
    deployments: "deployments",
  },
  namedAccounts: {
    deployer: 0
  },
};

export default config;
