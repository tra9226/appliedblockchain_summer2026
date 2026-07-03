// hardhat.config.js  — REPLACES your existing file at the repo root.
// Adds a Sepolia public-testnet network. RPC URL and private key are read
// from a .env file so no secrets live in source control.

require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const {
  SEPOLIA_RPC_URL = "",
  PRIVATE_KEY = "",
  ETHERSCAN_API_KEY = "",
} = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },

  networks: {
    // Public Ethereum testnet used for the end-to-end demo.
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },

  // Lets you run: npx hardhat verify --network sepolia <address>
  // so the contract source is readable on Sepolia Etherscan.
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },

  gasReporter: {
    enabled: true,
    currency: "USD",
    offline: true,
    showMethodSig: true,
  },
};
