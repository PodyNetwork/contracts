const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("PodyGiftModule", (m) => {
  const tokenAddress = m.getParameter("tokenAddress");
  const initialFee = m.getParameter("initialFee");
  const initialMinGiftAmount = m.getParameter("initialMinGiftAmount");

  const podyGift = m.contract("PodyGift", [tokenAddress, initialFee, initialMinGiftAmount]);

  return { podyGift };
});