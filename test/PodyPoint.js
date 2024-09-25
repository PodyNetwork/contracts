const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PodyPoint", function () {
  async function deployPodyPointFixture() {
    const [owner, otherAccount, multiSigWallet] = await ethers.getSigners();

    const PodyPoint = await ethers.getContractFactory("PodyPoint");
    const podyPoint = await PodyPoint.deploy(multiSigWallet.address);

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockERC20 = await MockERC20.deploy("MockToken", "MTK");

    return { podyPoint, mockERC20, owner, otherAccount, multiSigWallet };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { podyPoint, owner } = await loadFixture(deployPodyPointFixture);
      expect(await podyPoint.owner()).to.equal(owner.address);
    });

    it("Should set the correct hash rates and prices", async function () {
      const { podyPoint } = await loadFixture(deployPodyPointFixture);
      expect(await podyPoint.hashRates(1)).to.equal(ethers.parseEther("1"));
      expect(await podyPoint.hashRates(2)).to.equal(ethers.parseEther("1"));
      expect(await podyPoint.hashRates(3)).to.equal(ethers.parseEther("2"));
      expect(await podyPoint.hashRates(4)).to.equal(ethers.parseEther("2.5"));
      expect(await podyPoint.hashRates(5)).to.equal(ethers.parseEther("3"));

      expect(await podyPoint.prices(1)).to.equal(0);
      expect(await podyPoint.prices(2)).to.equal(ethers.parseEther("0.01"));
      expect(await podyPoint.prices(3)).to.equal(ethers.parseEther("0.02"));
      expect(await podyPoint.prices(4)).to.equal(ethers.parseEther("0.04"));
      expect(await podyPoint.prices(5)).to.equal(ethers.parseEther("0.05"));
    });
  });

  describe("Minting", function () {
    it("Should mint an NFT and update user data", async function () {
      const { podyPoint, owner, otherAccount } = await loadFixture(deployPodyPointFixture);
      await podyPoint.connect(owner).mint(otherAccount.address, "0x", { value: ethers.parseEther("0.01") });
      const user = await podyPoint.users(otherAccount.address);
      expect(user.hashRate).to.equal(ethers.parseEther("1"));
      expect(user.level).to.equal(1);
    });

    it("Should fail if insufficient funds are sent", async function () {
      const { podyPoint, owner, otherAccount } = await loadFixture(deployPodyPointFixture);
    
      // First, mint a Bronze NFT (which is free)
      await podyPoint.connect(owner).mint(otherAccount.address, "0x");
      
      // Now try to mint a Silver NFT with insufficient funds
      await expect(podyPoint.connect(owner).mint(otherAccount.address, "0x", { value: ethers.parseEther("0.005") }))
        .to.be.revertedWith("Insufficient funds sent");
    });

    it("Should upgrade the NFT if user already has one", async function () {
      const { podyPoint, owner, otherAccount } = await loadFixture(deployPodyPointFixture);
      
      await podyPoint.connect(owner).mint(otherAccount.address, "0x", { value: ethers.parseEther("0") });
      
      const silverPrice = await podyPoint.prices(2);
      
      await podyPoint.connect(owner).mint(otherAccount.address, "0x", { value: silverPrice });
      
      const goldPrice = await podyPoint.prices(3);
      
      await podyPoint.connect(owner).mint(otherAccount.address, "0x", { value: goldPrice });
      
      const user = await podyPoint.users(otherAccount.address);
      expect(user.hashRate).to.equal(ethers.parseEther("2"));
      expect(user.level).to.equal(3);
    });
  });


describe("Claiming Points", function () {
  it("Should claim points correctly", async function () {
    const { podyPoint, owner, otherAccount } = await loadFixture(deployPodyPointFixture);
    const nonce = ethers.hexlify(ethers.randomBytes(32)).toString(); // Generate a random nonce
    const secondsOnCall = 3600;
    const isHost = true;
    const numberOfParticipants = 10;

    await podyPoint.connect(owner).mint(otherAccount.address, "0x", { value: ethers.parseEther("0.01") });

    const messageHash = await podyPoint.generatePoints(
      otherAccount.address,
      secondsOnCall,
      numberOfParticipants,
      nonce,
      isHost
    );

    const signature = await owner.signMessage(ethers.getBytes(messageHash));

    await podyPoint.connect(otherAccount).claimPoints(
      otherAccount.address,
      secondsOnCall,
      numberOfParticipants,
      nonce,
      isHost,
      signature
    );

    const user = await podyPoint.users(otherAccount.address);
    expect(user.points).to.be.above(0);
  });

  it("Should fail with invalid nonce", async function () {
    const { podyPoint, owner, otherAccount } = await loadFixture(deployPodyPointFixture);
    const nonce = "unique_nonce";
    const secondsOnCall = 3600;
    const isHost = true;
    const numberOfParticipants = 10;

    await podyPoint.connect(owner).mint(otherAccount.address, "0x", { value: ethers.parseEther("0.01") });

    const messageHash = await podyPoint.generatePoints(
      otherAccount.address,
      secondsOnCall,
      numberOfParticipants,
      nonce,
      isHost
    );
    const signature = await owner.signMessage(ethers.getBytes(messageHash));

    await podyPoint.connect(otherAccount).claimPoints(
      otherAccount.address,
      secondsOnCall,
      numberOfParticipants,
      nonce,
      isHost,
      signature
    );

    // Try to claim with the same nonce again
    await expect(podyPoint.connect(otherAccount).claimPoints(
      otherAccount.address,
      secondsOnCall,
      numberOfParticipants,
      nonce,
      isHost,
      signature
    )).to.be.revertedWith("Invalid nonce");
  });

  it("Should fail with invalid admin signature", async function () {
    const { podyPoint, owner, otherAccount } = await loadFixture(deployPodyPointFixture);
    const nonce = "unique_nonce";
    const secondsOnCall = 3600;
    const isHost = true;
    const numberOfParticipants = 10;

    await podyPoint.connect(owner).mint(otherAccount.address, "0x", { value: ethers.parseEther("0.01") });

    const messageHash = await podyPoint.generatePoints(
      otherAccount.address,
      secondsOnCall,
      numberOfParticipants,
      nonce,
      isHost
    );
    const signature = await otherAccount.signMessage(ethers.getBytes(messageHash)); // Using otherAccount instead of owner

    await expect(podyPoint.connect(otherAccount).claimPoints(
      otherAccount.address,
      secondsOnCall,
      numberOfParticipants,
      nonce,
      isHost,
      signature
    )).to.be.revertedWith("Invalid admin signature");
  });
});


  describe("Withdrawals", function () {

    it("Should allow owner to withdraw ERC20 tokens", async function () {
      const { podyPoint, mockERC20, owner, otherAccount } = await loadFixture(deployPodyPointFixture);
      
      const podyPointAddress = await podyPoint.getAddress();
      const mockERC20Address = await mockERC20.getAddress();
      const ownerAddress = await owner.getAddress();
      const otherAccountAddress = await otherAccount.getAddress();

      // Mint some tokens to the PodyPoint contract
      await mockERC20.mint(podyPointAddress, ethers.parseEther("100"));
      
      // Check the initial balance
      expect(await mockERC20.balanceOf(podyPointAddress)).to.equal(ethers.parseEther("100"));
      
      // Withdraw tokens
      const withdrawAmount = ethers.parseEther("50");
      await podyPoint.connect(owner).withdrawERC20(mockERC20Address, otherAccountAddress, withdrawAmount);
      
      // Check the final balances
      expect(await mockERC20.balanceOf(podyPointAddress)).to.equal(ethers.parseEther("50"));
      expect(await mockERC20.balanceOf(otherAccountAddress)).to.equal(withdrawAmount);
    });

    it("Should not allow non-owner to withdraw ERC20 tokens", async function () {
      const { podyPoint, mockERC20, otherAccount } = await loadFixture(deployPodyPointFixture);
      
      // Ensure both contracts are deployed
      expect(await ethers.provider.getCode(await podyPoint.getAddress())).to.not.equal('0x');
      expect(await ethers.provider.getCode(await mockERC20.getAddress())).to.not.equal('0x');
      
      // Try to withdraw ERC20 tokens as non-owner
      await expect(
        podyPoint.connect(otherAccount).withdrawERC20(
          await mockERC20.getAddress(),
          await otherAccount.getAddress(),
          ethers.parseEther("1")
        )
      ).to.be.revertedWithCustomError(podyPoint, "OwnableUnauthorizedAccount");
    });

   
    it("Should fail to withdraw ERC20 tokens if insufficient balance", async function () {
      const { podyPoint, mockERC20, owner, otherAccount } = await loadFixture(deployPodyPointFixture);
      
      const podyPointAddress = await podyPoint.getAddress();
      const mockERC20Address = await mockERC20.getAddress();
      const otherAccountAddress = await otherAccount.getAddress();

      // Mint a small amount of tokens to the PodyPoint contract
      await mockERC20.mint(podyPointAddress, ethers.parseEther("1"));
      
      // Check the initial balance
      expect(await mockERC20.balanceOf(podyPointAddress)).to.equal(ethers.parseEther("1"));
      
      // Try to withdraw more tokens than available
      const withdrawAmount = ethers.parseEther("2");
      await expect(
        podyPoint.connect(owner).withdrawERC20(mockERC20Address, otherAccountAddress, withdrawAmount)
      ).to.be.revertedWith("Insufficient token balance");
      
      // Check that the balance hasn't changed
      expect(await mockERC20.balanceOf(podyPointAddress)).to.equal(ethers.parseEther("1"));
    });
  });
});