const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("PodyTokenModule", (m) => {
  const supply = m.getParameter("supply");

  const podyToken = m.contract("PodyToken", [supply]);

  return { podyToken };
});