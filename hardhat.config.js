require("@nomicfoundation/hardhat-toolbox");

const dotenv = require("dotenv");
dotenv.config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100
      },
      viaIR: true,
    },
  },
  networks: {
    opencampus: {
      url: `https://open-campus-codex-sepolia.drpc.org`,
      accounts: {
        mnemonic: process.env.PASSPHRASE ?? "",
      },
    }
  }
};