require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    // No external API calls in the sandbox; report raw gas only.
    offline: true,
    showMethodSig: true,
  },
};
