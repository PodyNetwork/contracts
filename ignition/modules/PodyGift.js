const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("PodyGiftModule", (m) => {
  const tokenAddress = m.getParameter("tokenAddress");
  const initialFee = m.getParameter("initialFee");
  const initialMinGiftAmount = m.getParameter("initialMinGiftAmount");
  const initialMaxGiftAmount = m.getParameter("initialMaxGiftAmount");
  const initialMinEtherAmount = m.getParameter("initialMinEtherAmount");
  const initialMaxEtherAmount = m.getParameter("initialMaxEtherAmount");

  const podyGift = m.contract("PodyGift", [tokenAddress, initialFee, initialMinGiftAmount, initialMaxGiftAmount, initialMinEtherAmount, initialMaxEtherAmount]);

  return { podyGift };
});