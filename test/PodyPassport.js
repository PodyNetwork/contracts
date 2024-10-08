const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PodyPassport", function () {
  async function deployPodyPassportFixture() {
    const [owner, otherAccount, multiSigWallet] = await ethers.getSigners();

    const PodyPassport = await ethers.getContractFactory("PodyPassport");
    const podyPassport = await PodyPassport.deploy(multiSigWallet.address);

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockERC20 = await MockERC20.deploy("MockToken", "MTK");

    const points = 100;
    return { points, podyPassport, mockERC20, owner, otherAccount, multiSigWallet };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { podyPassport, owner } = await loadFixture(deployPodyPassportFixture);
      expect(await podyPassport.owner()).to.equal(owner.address);
    });

    it("Should set the correct hash rates and prices", async function () {
      const { podyPassport } = await loadFixture(deployPodyPassportFixture);
      expect(await podyPassport.hashRates(1)).to.equal(ethers.parseEther("1"));
      expect(await podyPassport.hashRates(2)).to.equal(ethers.parseEther("1"));
      expect(await podyPassport.hashRates(3)).to.equal(ethers.parseEther("2"));
      expect(await podyPassport.hashRates(4)).to.equal(ethers.parseEther("2.5"));
      expect(await podyPassport.hashRates(5)).to.equal(ethers.parseEther("3"));
  
      expect(await podyPassport.prices(1)).to.equal(0);
      expect(await podyPassport.prices(2)).to.equal(ethers.parseEther("0.001"));
      expect(await podyPassport.prices(3)).to.equal(ethers.parseEther("0.002"));
      expect(await podyPassport.prices(4)).to.equal(ethers.parseEther("0.004"));
      expect(await podyPassport.prices(5)).to.equal(ethers.parseEther("0.005"));
    });

    it("Should set the correct multiSigWallet", async function () {
      const { podyPassport, multiSigWallet } = await loadFixture(deployPodyPassportFixture);
      expect(await podyPassport.multiSigWallet()).to.equal(multiSigWallet.address);
    });
  });

  describe("Minting", function () {
    it("Should mint an NFT and update user data", async function () {
      const { podyPassport, owner, otherAccount } = await loadFixture(deployPodyPassportFixture);
      await podyPassport.connect(owner).mint(otherAccount.address, "0x", { value: ethers.parseEther("0.01") });
      const user = await podyPassport.users(otherAccount.address);
      expect(user.hashRate).to.equal(ethers.parseEther("1"));
      expect(user.level).to.equal(1);
    });

    it("Should fail if insufficient funds are sent", async function () {
      const { podyPassport, owner, otherAccount } = await loadFixture(deployPodyPassportFixture);
    
      // First, mint a Bronze NFT (which is free)
      await podyPassport.connect(owner).mint(otherAccount.address, "0x");
      
      // Now try to mint a Silver NFT with insufficient funds
      await expect(podyPassport.connect(owner).mint(otherAccount.address, "0x", { value: ethers.parseEther("0.005") }))
        .to.be.revertedWith("Insufficient funds sent");
    });

    it("Should upgrade the NFT if user already has one", async function () {
      const { podyPassport, owner, otherAccount } = await loadFixture(deployPodyPassportFixture);
      
      await podyPassport.connect(owner).mint(otherAccount.address, "0x", { value: ethers.parseEther("0") });
      
      const silverPrice = await podyPassport.prices(2);
      
      await podyPassport.connect(owner).mint(otherAccount.address, "0x", { value: silverPrice });
      
      const goldPrice = await podyPassport.prices(3);
      
      await podyPassport.connect(owner).mint(otherAccount.address, "0x", { value: goldPrice });
      
      const user = await podyPassport.users(otherAccount.address);
      expect(user.hashRate).to.equal(ethers.parseEther("2"));
      expect(user.level).to.equal(3);
    });

    it("Should fail if user has reached maximum level", async function () {
      const { podyPassport, owner, otherAccount } = await loadFixture(deployPodyPassportFixture);
      
      // Mint all levels
      for (let i = 1; i <= 5; i++) {
        const price = await podyPassport.prices(i);
        await podyPassport.connect(owner).mint(otherAccount.address, "0x", { value: price });
      }
      
      // Try to mint again
      await expect(podyPassport.connect(owner).mint(otherAccount.address, "0x", { value: ethers.parseEther("1") }))
        .to.be.revertedWith("You have reached the maximum level");
    });

    it("Should emit NFTMinted event", async function () {
      const { podyPassport, owner, otherAccount } = await loadFixture(deployPodyPassportFixture);
      
      await expect(podyPassport.connect(owner).mint(otherAccount.address, "0x"))
        .to.emit(podyPassport, "NFTMinted")
        .withArgs(otherAccount.address, 1);
    });
  });


   describe("Claiming Points", function () {
    it("Should claim points correctly", async function () {
      const { podyPassport, owner, otherAccount, points } = await loadFixture(deployPodyPassportFixture);
      const nonce = ethers.hexlify(ethers.randomBytes(32));

      await podyPassport.connect(owner).mint(otherAccount.address, "0x", { value: ethers.parseEther("0.001") });

      const messageHash = await podyPassport.generatePoints(
        otherAccount.address,
        nonce,
        points,
      );

      const signature = await owner.signMessage(ethers.getBytes(messageHash));

      await podyPassport.connect(otherAccount).claimPoints(
        otherAccount.address,
        nonce,
        points,
        signature
      );

      const user = await podyPassport.users(otherAccount.address);
      expect(user.points).to.be.above(0);
    });

    it("Should fail with invalid nonce", async function () {
      const { podyPassport, owner, otherAccount, points } = await loadFixture(deployPodyPassportFixture);
      const nonce = ethers.hexlify(ethers.randomBytes(32));

      await podyPassport.connect(owner).mint(otherAccount.address, "0x", { value: ethers.parseEther("0.001") });

      const messageHash = await podyPassport.generatePoints(
        otherAccount.address,
        nonce,
        points,
      );
      const signature = await owner.signMessage(ethers.getBytes(messageHash));

      await podyPassport.connect(otherAccount).claimPoints(
        otherAccount.address,
        nonce,
        points,
        signature
      );

      // Try to claim with the same nonce again
      await expect(podyPassport.connect(otherAccount).claimPoints(
        otherAccount.address,
        nonce,
        points,
        signature
      )).to.be.revertedWith("Invalid nonce");
    });

    it("Should emit PointsClaimed event", async function () {
      const { podyPassport, owner, otherAccount, points } = await loadFixture(deployPodyPassportFixture);
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const secondsOnCall = 3600;

      await podyPassport.connect(owner).mint(otherAccount.address, "0x", { value: ethers.parseEther("0.001") });

      const messageHash = await podyPassport.generatePoints(
        otherAccount.address,
        nonce,
        points,
      );
      const signature = await owner.signMessage(ethers.getBytes(messageHash));

      await expect(podyPassport.connect(otherAccount).claimPoints(
        otherAccount.address,
        nonce,
        points,
        signature
      )).to.emit(podyPassport, "PointsClaimed").withArgs(otherAccount.address, points);
    });
  });
  

  describe("Withdrawals", function () {

    it("Should allow owner to withdraw ERC20 tokens", async function () {
      const { podyPassport, mockERC20, owner, otherAccount } = await loadFixture(deployPodyPassportFixture);
      
      const podyPassportAddress = await podyPassport.getAddress();
      const mockERC20Address = await mockERC20.getAddress();
      const otherAccountAddress = await otherAccount.getAddress();

      // Mint some tokens to the PodyPassport contract
      await mockERC20.mint(podyPassportAddress, ethers.parseEther("100"));
      
      // Check the initial balance
      expect(await mockERC20.balanceOf(podyPassportAddress)).to.equal(ethers.parseEther("100"));
      
      // Withdraw tokens
      const withdrawAmount = ethers.parseEther("50");
      await podyPassport.connect(owner).withdrawERC20(mockERC20Address, otherAccountAddress, withdrawAmount);
      
      // Check the final balances
      expect(await mockERC20.balanceOf(podyPassportAddress)).to.equal(ethers.parseEther("50"));
      expect(await mockERC20.balanceOf(otherAccountAddress)).to.equal(withdrawAmount);
    });

    it("Should not allow non-owner to withdraw ERC20 tokens", async function () {
      const { podyPassport, mockERC20, otherAccount } = await loadFixture(deployPodyPassportFixture);
      
      // Ensure both contracts are deployed
      expect(await ethers.provider.getCode(await podyPassport.getAddress())).to.not.equal('0x');
      expect(await ethers.provider.getCode(await mockERC20.getAddress())).to.not.equal('0x');
      
      // Try to withdraw ERC20 tokens as non-owner
      await expect(
        podyPassport.connect(otherAccount).withdrawERC20(
          await mockERC20.getAddress(),
          await otherAccount.getAddress(),
          ethers.parseEther("1")
        )
      ).to.be.revertedWithCustomError(podyPassport, "OwnableUnauthorizedAccount");
    });

   
    it("Should fail to withdraw ERC20 tokens if insufficient balance", async function () {
      const { podyPassport, mockERC20, owner, otherAccount } = await loadFixture(deployPodyPassportFixture);
      
      const podyPassportAddress = await podyPassport.getAddress();
      const mockERC20Address = await mockERC20.getAddress();
      const otherAccountAddress = await otherAccount.getAddress();

      // Mint a small amount of tokens to the PodyPassport contract
      await mockERC20.mint(podyPassportAddress, ethers.parseEther("1"));
      
      // Check the initial balance
      expect(await mockERC20.balanceOf(podyPassportAddress)).to.equal(ethers.parseEther("1"));
      
      // Try to withdraw more tokens than available
      const withdrawAmount = ethers.parseEther("2");
      await expect(
        podyPassport.connect(owner).withdrawERC20(mockERC20Address, otherAccountAddress, withdrawAmount)
      ).to.be.revertedWith("Insufficient token balance");
      
      // Check that the balance hasn't changed
      expect(await mockERC20.balanceOf(podyPassportAddress)).to.equal(ethers.parseEther("1"));
    });

    it("Should fail to withdraw ERC20 tokens if token address is zero", async function () {
      const { podyPassport, owner, otherAccount } = await loadFixture(deployPodyPassportFixture);
      
      await expect(
        podyPassport.connect(owner).withdrawERC20(ethers.ZeroAddress, otherAccount.address, ethers.parseEther("1"))
      ).to.be.revertedWith("Invalid token address");
    });

    it("Should fail to withdraw ERC20 tokens if recipient address is zero", async function () {
      const { podyPassport, mockERC20, owner } = await loadFixture(deployPodyPassportFixture);
      
      await expect(
        podyPassport.connect(owner).withdrawERC20(await mockERC20.getAddress(), ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWith("Invalid recipient address");
    });

    it("Should fail to withdraw ERC20 tokens if amount is zero", async function () {
      const { podyPassport, mockERC20, owner, otherAccount } = await loadFixture(deployPodyPassportFixture);
      
      await expect(
        podyPassport.connect(owner).withdrawERC20(await mockERC20.getAddress(), otherAccount.address, 0)
      ).to.be.revertedWith("Amount must be greater than zero");
    });

    it("Should emit FundsWithdrawn event on successful withdrawal", async function () {
      const { podyPassport, mockERC20, owner, otherAccount } = await loadFixture(deployPodyPassportFixture);
      
      const podyPassportAddress = await podyPassport.getAddress();
      const mockERC20Address = await mockERC20.getAddress();
      const otherAccountAddress = await otherAccount.getAddress();

      // Mint some tokens to the PodyPassport contract
      await mockERC20.mint(podyPassportAddress, ethers.parseEther("100"));
      
      // Withdraw tokens
      const withdrawAmount = ethers.parseEther("50");
      await expect(podyPassport.connect(owner).withdrawERC20(mockERC20Address, otherAccountAddress, withdrawAmount))
        .to.emit(podyPassport, "FundsWithdrawn")
        .withArgs(mockERC20Address, otherAccountAddress, withdrawAmount);
    });
  });

  describe("Transfer restrictions", function () {
    it("Should not allow safeTransferFrom", async function () {
      const { podyPassport, owner, otherAccount } = await loadFixture(deployPodyPassportFixture);
      
      await podyPassport.connect(owner).mint(owner.address, "0x", { value: ethers.parseEther("0.001") });
      
      await expect(
        podyPassport.connect(owner).safeTransferFrom(owner.address, otherAccount.address, 1, 1, "0x")
      ).to.be.revertedWith("Transfers are not allowed");
    });

    it("Should not allow safeBatchTransferFrom", async function () {
      const { podyPassport, owner, otherAccount } = await loadFixture(deployPodyPassportFixture);
      
      await podyPassport.connect(owner).mint(owner.address, "0x", { value: ethers.parseEther("0.001") });
      
      await expect(
        podyPassport.connect(owner).safeBatchTransferFrom(owner.address, otherAccount.address, [1], [1], "0x")
      ).to.be.revertedWith("Transfers are not allowed");
    });
  });

  describe("MultiSig wallet management", function () {
    it("Should allow owner to set new multiSig wallet", async function () {
      const { podyPassport, owner, otherAccount } = await loadFixture(deployPodyPassportFixture);
      
      await podyPassport.connect(owner).setMultiSigWallet(otherAccount.address);
      
      expect(await podyPassport.multiSigWallet()).to.equal(otherAccount.address);
    });

    it("Should not allow non-owner to set new multiSig wallet", async function () {
      const { podyPassport, otherAccount } = await loadFixture(deployPodyPassportFixture);
      
      await expect(
        podyPassport.connect(otherAccount).setMultiSigWallet(otherAccount.address)
      ).to.be.revertedWithCustomError(podyPassport, "OwnableUnauthorizedAccount");
    });

    it("Should not allow setting zero address as multiSig wallet", async function () {
      const { podyPassport, owner } = await loadFixture(deployPodyPassportFixture);
      
      await expect(
        podyPassport.connect(owner).setMultiSigWallet(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid multisig wallet address");
    });
  });
});