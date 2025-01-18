const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("PodyTokenModule", (m) => {
  const supply = m.getParameter("supply");
  const multiSigWallet = m.getParameter("multiSigWallet");

  const podyToken = m.contract("PodyToken", [multiSigWallet, supply]);

  return { podyToken };
});