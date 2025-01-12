// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./PodyToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PodyGift
 * @dev This contract allows users to send gifts in the form of tokens or Ether, with configurable commission fees and gift limits.
 */
contract PodyGift is Ownable2Step {
    PodyToken public token;
    uint256 public commissionFee;
    mapping(address => uint256) public minGiftAmountForToken;
    mapping(address => uint256) public maxGiftAmountForToken;
    mapping(address => bool) public whitelistedTokens;
    
    uint256 public minEtherGiftAmount;
    uint256 public maxEtherGiftAmount;

    event GiftSent(address indexed sender, address indexed recipient, address tokenAddress, uint256 amountSent, uint256 commission);
    event FeeUpdated(uint256 newFee);
    event TokenUpdated(address newTokenAddress);
    event TokenWhitelisted(address tokenAddress, bool isWhitelisted);
    event MinMaxGiftAmountUpdated(address tokenAddress, uint256 newMinAmount, uint256 newMaxAmount);
    event MinMaxEtherGiftAmountUpdated(uint256 newMinEtherAmount, uint256 newMaxEtherAmount);

    constructor(address tokenAddress, uint256 initialFee, uint256 initialMinGiftAmount, uint256 initialMaxGiftAmount, uint256 initialMinEtherAmount, uint256 initialMaxEtherAmount) Ownable(msg.sender) {
        token = PodyToken(tokenAddress);
        commissionFee = initialFee;
        
        minGiftAmountForToken[tokenAddress] = initialMinGiftAmount;
        maxGiftAmountForToken[tokenAddress] = initialMaxGiftAmount;

        minEtherGiftAmount = initialMinEtherAmount;
        maxEtherGiftAmount = initialMaxEtherAmount;
        
        whitelistedTokens[tokenAddress] = true;
        emit TokenWhitelisted(tokenAddress, true);
    }

    /**
     * @dev Sends tokens to a recipient, deducting a commission fee.
     * @param recipient The address of the recipient.
     * @param amount The amount of tokens to send.
     */
    function giftTokens(address recipient, uint256 amount) external {
        require(recipient != address(0), "Recipient address cannot be zero");
        require(amount >= minGiftAmountForToken[address(token)], "Amount below minimum for this token");
        require(amount <= maxGiftAmountForToken[address(token)], "Amount exceeds maximum for this token");

        uint256 commission = (amount * commissionFee) / 10000;
        uint256 amountAfterCommission = amount - commission;

        token.transferFrom(msg.sender, recipient, amountAfterCommission);
        token.transferFrom(msg.sender, owner(), commission);

        emit GiftSent(msg.sender, recipient, address(token), amountAfterCommission, commission);
    }

    /**
     * @dev Sends tokens to a recipient using a specified token address, deducting a commission fee.
     * @param recipient The address of the recipient.
     * @param amount The amount of tokens to send.
     * @param tokenAddress The address of the token to send.
     */
    function giftTokens(address recipient, uint256 amount, address tokenAddress) external {
        require(recipient != address(0), "Recipient address cannot be zero");
        require(tokenAddress != address(0), "Token address cannot be zero");
        require(whitelistedTokens[tokenAddress], "Token not whitelisted");
        require(amount >= minGiftAmountForToken[tokenAddress], "Amount below minimum for this token");
        require(amount <= maxGiftAmountForToken[tokenAddress], "Amount exceeds maximum for this token");

        uint256 commission = (amount * commissionFee) / 10000;
        uint256 amountAfterCommission = amount - commission;

        IERC20(tokenAddress).transferFrom(msg.sender, recipient, amountAfterCommission);
        IERC20(tokenAddress).transferFrom(msg.sender, owner(), commission);

        emit GiftSent(msg.sender, recipient, tokenAddress, amountAfterCommission, commission);
    }

    /**
     * @dev Sends Ether to a recipient, deducting a commission fee.
     * @param recipient The address of the recipient.
     */
    function giftEther(address payable recipient) external payable {
        require(recipient != address(0), "Recipient address cannot be zero");
        require(msg.value >= minEtherGiftAmount, "Amount below minimum for Ether");
        require(msg.value <= maxEtherGiftAmount, "Amount exceeds maximum for Ether");

        uint256 commission = (msg.value * commissionFee) / 10000;
        uint256 amountAfterCommission = msg.value - commission;

        (bool success, ) = recipient.call{value: amountAfterCommission}("");
        require(success, "Failed to send Ether to recipient");
        (success, ) = payable(owner()).call{value: commission}("");
        require(success, "Failed to send Ether to owner");

        emit GiftSent(msg.sender, recipient, 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE, amountAfterCommission, commission);
    }

    /**
     * @dev Updates the commission fee for gifts.
     * @param newFee The new commission fee (in basis points).
     */
    function updateCommissionFee(uint256 newFee) external onlyOwner {
        require(newFee <= 5000, "Fee cannot exceed 50%");
        commissionFee = newFee;
        emit FeeUpdated(newFee);
    }

    /**
     * @dev Updates the minimum and maximum gift amounts for a specific token.
     * @param tokenAddress The address of the token.
     * @param newMinAmount The new minimum gift amount.
     * @param newMaxAmount The new maximum gift amount.
     */
    function updateMinMaxGiftAmount(address tokenAddress, uint256 newMinAmount, uint256 newMaxAmount) external onlyOwner {
        require(newMinAmount <= newMaxAmount, "Min amount cannot exceed max amount");
        minGiftAmountForToken[tokenAddress] = newMinAmount;
        maxGiftAmountForToken[tokenAddress] = newMaxAmount;
        emit MinMaxGiftAmountUpdated(tokenAddress, newMinAmount, newMaxAmount);
    }

    /**
     * @dev Updates the minimum and maximum Ether gift amounts.
     * @param newMinEtherAmount The new minimum Ether gift amount.
     * @param newMaxEtherAmount The new maximum Ether gift amount.
     */
    function updateMinMaxEtherGiftAmount(uint256 newMinEtherAmount, uint256 newMaxEtherAmount) external onlyOwner {
        require(newMinEtherAmount <= newMaxEtherAmount, "Min Ether amount cannot exceed max Ether amount");
        minEtherGiftAmount = newMinEtherAmount;
        maxEtherGiftAmount = newMaxEtherAmount;
        emit MinMaxEtherGiftAmountUpdated(newMinEtherAmount, newMaxEtherAmount);
    }

    /**
     * @dev Sets a token address as whitelisted or not.
     * @param tokenAddress The address of the token.
     * @param isWhitelisted Boolean indicating if the token is whitelisted.
     */
    function setWhitelistedToken(address tokenAddress, bool isWhitelisted) external onlyOwner {
        require(tokenAddress != address(0), "Token address cannot be zero");
        whitelistedTokens[tokenAddress] = isWhitelisted;
        emit TokenWhitelisted(tokenAddress, isWhitelisted);
    }

}
