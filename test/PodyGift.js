const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { constants } = require("ethers");

describe("PodyGift", function () {
  async function deployPodyGiftFixture() {
    const [owner, recipient, otherAccount] = await ethers.getSigners();

    const PodyToken = await ethers.getContractFactory("PodyToken");
    const podyToken = await PodyToken.deploy(ethers.parseEther('1000000'));

    const initialFee = 500;
    const initialMinGiftAmount = ethers.parseEther("0.1");
    const initialMaxGiftAmount = ethers.parseEther("5"); // Example value
    const initialMinEtherAmount = ethers.parseEther("0.01"); // Example value
    const initialMaxEtherAmount = ethers.parseEther("10"); // Example value

    const PodyGift = await ethers.getContractFactory("PodyGift");
    const giftContract = await PodyGift.deploy(
      await podyToken.getAddress(),
      initialFee,
      initialMinGiftAmount,
      initialMaxGiftAmount,
      initialMinEtherAmount,
      initialMaxEtherAmount
    );

    return { giftContract, podyToken, owner, recipient, otherAccount };
  }

  describe("Gift Tokens", function () {
    it("Should send tokens correctly after commission deduction", async function () {
      const { giftContract, podyToken, owner, recipient } = await loadFixture(deployPodyGiftFixture);

      await podyToken.connect(owner).approve(await giftContract.getAddress(), ethers.parseEther("10"));

      const giftAmount = ethers.parseEther("1");
      await giftContract.connect(owner).giftTokens(await recipient.getAddress(), giftAmount);

      const commission = (giftAmount * BigInt(5)) / BigInt(100);
      const expectedRecipientBalance = giftAmount - commission;
      expect(await podyToken.balanceOf(await recipient.getAddress())).to.equal(expectedRecipientBalance);
    });

    it("Should not allow gifting below the minimum gift amount for general users", async function () {
      const { giftContract, podyToken, recipient } = await loadFixture(deployPodyGiftFixture);

      await podyToken.approve(await giftContract.getAddress(), ethers.parseEther("10"));

      const smallGiftAmount = ethers.parseEther("0.05");
      await expect(giftContract.giftTokens(await recipient.getAddress(), smallGiftAmount))
        .to.be.revertedWith('Amount below minimum for this token');
    });

    it("Should not allow gifting above the maximum gift amount for general users", async function () {
      const { giftContract, podyToken, recipient } = await loadFixture(deployPodyGiftFixture);

      await podyToken.approve(await giftContract.getAddress(), ethers.parseEther("20"));

      const largeGiftAmount = ethers.parseEther("20");
      await expect(giftContract.giftTokens(await recipient.getAddress(), largeGiftAmount))
        .to.be.revertedWith('Amount exceeds maximum for this token');
    });
  });

  describe("Admin-specific Min/Max", function () {
    it("Should allow admin to set their own minimum and maximum gift amount", async function () {
      const { giftContract, owner, podyToken } = await loadFixture(deployPodyGiftFixture);

      const newAdminMinGiftAmount = ethers.parseEther("0.2");
      const newAdminMaxGiftAmount = ethers.parseEther("15");

      await giftContract.connect(owner).updateMinMaxGiftAmount(await podyToken.getAddress(), newAdminMinGiftAmount, newAdminMaxGiftAmount);

      expect(await giftContract.minGiftAmountForToken(await podyToken.getAddress())).to.equal(newAdminMinGiftAmount);
      expect(await giftContract.maxGiftAmountForToken(await podyToken.getAddress())).to.equal(newAdminMaxGiftAmount);
    });
  });

  describe("Update Token Address", function () {
    it("Should not allow non-owner to update token address", async function () {
      const { giftContract, otherAccount } = await loadFixture(deployPodyGiftFixture);

      const NewPodyToken = await ethers.getContractFactory("PodyToken");
      const newPodyToken = await NewPodyToken.deploy(ethers.parseEther('1000000'));

      await expect(giftContract.connect(otherAccount).updateToken(await newPodyToken.getAddress()))
        .to.be.reverted;
    });

    it("Should not allow updating token address to zero address", async function () {
      const { giftContract } = await loadFixture(deployPodyGiftFixture);

      await expect(giftContract.updateToken("0x0000000000000000000000000000000000000000"))
        .to.be.revertedWith("Token address cannot be zero");
    });
  });
});
