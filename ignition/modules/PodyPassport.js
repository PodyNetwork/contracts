const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("PodyPassportModule", (m) => {
  const multiSigWallet = m.getParameter("multiSigWallet");

  const podyPassport = m.contract("PodyPassport", [multiSigWallet]);

  return { podyPassport };
});