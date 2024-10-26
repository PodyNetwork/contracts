const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PodyGift", function () {
  async function deployPodyGiftFixture() {
    const [owner, recipient, otherAccount] = await ethers.getSigners();

    const PodyToken = await ethers.getContractFactory("PodyToken");
    const podyToken = await PodyToken.deploy(ethers.parseEther('1000000'));

    const initialFee = 500;
    const initialMinGiftAmount = ethers.parseEther("0.1");
    const podyGift = await ethers.getContractFactory("PodyGift");
    const giftContract = await podyGift.deploy(await podyToken.getAddress(), initialFee, initialMinGiftAmount);

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

    it("Should not allow gifting below the minimum gift amount", async function () {
      const { giftContract, podyToken, recipient } = await loadFixture(deployPodyGiftFixture);
      
      await podyToken.approve(await giftContract.getAddress(), ethers.parseEther("10"));
      
      const smallGiftAmount = ethers.parseEther("0.05");
      await expect(giftContract.giftTokens(await recipient.getAddress(), smallGiftAmount))
        .to.be.revertedWith('Amount must be at least the minimum gift amount');
    });
  });

  describe("Update Commission Fee", function () {
    it("Should allow owner to update commission fee", async function () {
      const { giftContract } = await loadFixture(deployPodyGiftFixture);
      
      await giftContract.updateCommissionFee(300);
      expect(await giftContract.commissionFee()).to.equal(300);
    });

    it("Should not allow non-owner to update commission fee", async function () {
      const { giftContract, otherAccount } = await loadFixture(deployPodyGiftFixture);
      
      await expect(giftContract.connect(otherAccount).updateCommissionFee(300))
        .to.be.reverted;
    });

    it("Should not allow commission fee to exceed 10%", async function () {
      const { giftContract } = await loadFixture(deployPodyGiftFixture);
      
      await expect(giftContract.updateCommissionFee(1100))
        .to.be.revertedWith("Fee cannot exceed 10%");
    });
  });

  describe("Update Minimum Gift Amount", function () {
    it("Should allow owner to update minimum gift amount", async function () {
      const { giftContract } = await loadFixture(deployPodyGiftFixture);
      
      await giftContract.updateMinGiftAmount(ethers.parseEther("0.2"));
      expect(await giftContract.minGiftAmount()).to.equal(ethers.parseEther("0.2"));
    });
  });

  describe("Update Token Address", function () {
    it("Should allow owner to update token address", async function () {
      const { giftContract } = await loadFixture(deployPodyGiftFixture);
      
      const NewPodyToken = await ethers.getContractFactory("PodyToken");
      const newPodyToken = await NewPodyToken.deploy(ethers.parseEther('1000000')); 
      
      await giftContract.updateToken(await newPodyToken.getAddress()); 
      expect(await giftContract.token()).to.equal(await newPodyToken.getAddress());
    });
  });
});
