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

    /// @dev Represents a user in the system with their hash rate, points, and level.
    struct User {
        uint256 hashRate; // The user's hash rate
        uint256 points;    // The points accumulated by the user
        uint256 level;     // The user's current level
    }

    mapping(address => User) public users; // Mapping of user addresses to User structs
    mapping(uint256 => uint256) public hashRates; // Mapping of levels to hash rates
    mapping(uint256 => uint256) public prices; // Mapping of levels to prices
    mapping(string => bool) public usedNonces; // Mapping of nonces to their usage status

    address public multiSigWallet; // Address of the multisig wallet

    uint256 public constant BRONZE = 1; // Level constant for Bronze
    uint256 public constant SILVER = 2; // Level constant for Silver
    uint256 public constant GOLD = 3; // Level constant for Gold
    uint256 public constant PLATINUM = 4; // Level constant for Platinum
    uint256 public constant DIAMOND = 5; // Level constant for Diamond

    event NFTMinted(address indexed user, uint256 indexed id); // Event emitted when an NFT is minted
    event PointsClaimed(address indexed user, uint256 points); // Event emitted when points are claimed
    event FundsWithdrawn(address indexed token, address indexed to, uint256 amount); // Event emitted when funds are withdrawn

    error ClaimPointsOperationFailed(address signer, address owner); // Error for failed claim points operation

    /// @dev Constructor to initialize the contract with a multisig wallet address.
    /// @param _multiSigWallet The address of the multisig wallet.
    constructor(address _multiSigWallet) Ownable(msg.sender) ERC1155("https://api.pody.network/nft/pody-points/metadata/{id}.json") {
        require(_multiSigWallet != address(0), "Invalid multisig wallet address");
        multiSigWallet = _multiSigWallet;

        hashRates[BRONZE] = 1 ether;
        hashRates[SILVER] = 3 ether / 2;
        hashRates[GOLD] = 2 ether;
        hashRates[PLATINUM] = 5 ether / 2;
        hashRates[DIAMOND] = 3 ether;

        prices[BRONZE] = 0;
        prices[SILVER] = 1000000000000000; 
        prices[GOLD] = 2000000000000000; 
        prices[PLATINUM] = 4000000000000000; 
        prices[DIAMOND] = 5000000000000000; 
    }

    /// @dev Mints a new NFT for the specified account.
    /// @param account The address of the user receiving the NFT.
    /// @param data Additional data to pass with the minting.
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

    /// @dev Claims points for a user based on a signed message.
    /// @param userAddress The address of the user claiming points.
    /// @param nonce A unique nonce to prevent replay attacks.
    /// @param points The number of points to claim.
    /// @param signature The signature from the admin to authorize the claim.
    function claimPoints(
        address userAddress,
        string memory nonce,
        uint256 points,
        bytes memory signature
    ) external {
        require(!usedNonces[nonce], "Invalid nonce");
        User storage user = users[userAddress];
        bytes32 messageHash = generatePoints(userAddress, nonce, points);
        address signer = messageHash.toEthSignedMessageHash().recover(signature);
        require(signer == owner(), "Invalid admin signature");
        user.points += points;
        usedNonces[nonce] = true;
        emit PointsClaimed(userAddress, points);
    }

    /// @dev Generates a hash for the points claim message.
    /// @param userAddress The address of the user.
    /// @param nonce A unique nonce.
    /// @param points The number of points.
    /// @return The generated message hash.
    function generatePoints(
        address userAddress,
        string memory nonce,
        uint256 points
    ) public view returns (bytes32) {
        return keccak256(abi.encodePacked(userAddress, points, nonce, address(this), block.chainid));
    }

    /// @dev Overrides the safeTransferFrom function to prevent transfers of Pody Passport.
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public virtual override {
        revert("Transfers are not allowed");
    }

    /// @dev Overrides the safeBatchTransferFrom function to prevent transfers of Pody Passport.
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public virtual override {
        revert("Transfers are not allowed");
    }

    /// @dev Sets a new multisig wallet address.
    /// @param _multiSigWallet The new multisig wallet address.
    function setMultiSigWallet(address _multiSigWallet) external onlyOwner {
        require(_multiSigWallet != address(0), "Invalid multisig wallet address");
        multiSigWallet = _multiSigWallet;
    }

    /// @dev Withdraws ERC20 tokens from the contract.
    /// @param token The ERC20 token to withdraw.
    /// @param to The address to send the tokens to.
    /// @param amount The amount of tokens to withdraw.
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