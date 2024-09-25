const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("PodyPointModule", (m) => {
  const multiSigWallet = m.getParameter("multiSigWallet");

  const podyPoint = m.contract("PodyPoint", [multiSigWallet]);

  return { podyPoint };
});