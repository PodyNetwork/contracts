// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PodyPassport is ERC1155, Ownable2Step {
    using MessageHashUtils for bytes32;
    using ECDSA for bytes32;
    using Math for uint256;

    struct User {
        uint256 hashRate;
        uint256 points;
        uint256 level;
    }

    mapping(address => User) public users;
    mapping(uint256 => uint256) public hashRates;
    mapping(uint256 => uint256) public prices;
    mapping(string => bool) public usedNonces;

    address public multiSigWallet;

    uint256 public constant BRONZE = 1;
    uint256 public constant SILVER = 2;
    uint256 public constant GOLD = 3;
    uint256 public constant PLATINUM = 4;
    uint256 public constant DIAMOND = 5;

    event NFTMinted(address indexed user, uint256 indexed id);
    event PointsClaimed(address indexed user, uint256 points);
    event FundsWithdrawn(address indexed token, address indexed to, uint256 amount);

    error ClaimPointsOperationFailed(address signer, address owner);

    constructor(address _multiSigWallet) Ownable(msg.sender) ERC1155("https://api.pody.network/nft/pody-points/metadata/{id}.json") {
        require(_multiSigWallet != address(0), "Invalid multisig wallet address");
        multiSigWallet = _multiSigWallet;

        hashRates[BRONZE] = 1 ether;
        hashRates[SILVER] = 1 ether;
        hashRates[GOLD] = 2 ether;
        hashRates[PLATINUM] = 5 ether / 2;
        hashRates[DIAMOND] = 3 ether;

        prices[BRONZE] = 0;
        prices[SILVER] = 1000000000000000; 
        prices[GOLD] = 2000000000000000; 
        prices[PLATINUM] = 4000000000000000; 
        prices[DIAMOND] = 5000000000000000; 
    }

    function mint(address account, bytes memory data) external payable {
        User storage user = users[account];
        require(user.level < 5, "You have reached the maximum level");
        uint256 nextLevel = user.level + 1;
        if (user.level != 0) {
            require(msg.value == prices[nextLevel], "Insufficient funds sent");
            (bool success, ) = multiSigWallet.call{value: msg.value}("");
            require(success, "Failed to send funds to multisig wallet");
            emit FundsWithdrawn(address(0), multiSigWallet, msg.value);
        }
        _mint(account, nextLevel, 1, data);
        user.hashRate = hashRates[nextLevel];
        user.level = nextLevel;
        emit NFTMinted(account, nextLevel);
    }

    function claimPoints(
        address userAddress,
        uint256 secondsOnCall,
        uint256 numberOfParticipants,
        string memory nonce,
        bool isHost,
        uint256 snapshottedHashRate,
        bytes memory signature
    ) external {
        require(!usedNonces[nonce], "Invalid nonce");
        User storage user = users[userAddress];
        require(user.hashRate > 0 && snapshottedHashRate > 0, "Hash rate is 0");
        require(snapshottedHashRate <= user.hashRate, "Invalid hash rate");
        bytes32 messageHash = generatePoints(userAddress, secondsOnCall, numberOfParticipants, nonce, isHost, snapshottedHashRate);
        address signer = messageHash.toEthSignedMessageHash().recover(signature);
        require(signer == owner(), "Invalid admin signature");
        uint256 points = (snapshottedHashRate * secondsOnCall);
        if (isHost) {
            require(numberOfParticipants > 0, "Number of participants must be greater than zero");
            points += (((secondsOnCall) * Math.log10(numberOfParticipants)) * 1 ether);
        }
        user.points = user.points + points;
        usedNonces[nonce] = true;
        emit PointsClaimed(userAddress, points);
    }

    function generatePoints(
        address userAddress,
        uint256 secondsOnCall,
        uint256 numberOfParticipants,
        string memory nonce,
        bool isHost,
        uint256 snapshottedHashRate
    ) public view returns (bytes32) {
        if (isHost) {
            return keccak256(abi.encodePacked(userAddress, secondsOnCall, numberOfParticipants, nonce, isHost, snapshottedHashRate, address(this), block.chainid));
        } else {
            return keccak256(abi.encodePacked(userAddress, secondsOnCall, nonce, snapshottedHashRate, address(this), block.chainid));
        }
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public virtual override {
        revert("Transfers are not allowed");
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public virtual override {
        revert("Transfers are not allowed");
    }

    function setMultiSigWallet(address _multiSigWallet) external onlyOwner {
        require(_multiSigWallet != address(0), "Invalid multisig wallet address");
        multiSigWallet = _multiSigWallet;
    }

    function withdrawERC20(IERC20 token, address to, uint256 amount) external onlyOwner {
        require(address(token) != address(0), "Invalid token address");
        require(to != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than zero");
        uint256 balance = token.balanceOf(address(this));
        require(balance >= amount, "Insufficient token balance");
        bool success = token.transfer(to, amount);
        require(success, "Token transfer failed");
        emit FundsWithdrawn(address(token), to, amount);
    }
}