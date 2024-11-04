// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./PodyToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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

    function giftEther(address payable recipient) external payable {
        require(recipient != address(0), "Recipient address cannot be zero");
        require(msg.value >= minEtherGiftAmount, "Amount below minimum for Ether");
        require(msg.value <= maxEtherGiftAmount, "Amount exceeds maximum for Ether");

        uint256 commission = (msg.value * commissionFee) / 10000;
        uint256 amountAfterCommission = msg.value - commission;

        recipient.transfer(amountAfterCommission);
        payable(owner()).transfer(commission);

        emit GiftSent(msg.sender, recipient, address(0), amountAfterCommission, commission);
    }

    function updateCommissionFee(uint256 newFee) external onlyOwner {
        require(newFee <= 5000, "Fee cannot exceed 50%");
        commissionFee = newFee;
        emit FeeUpdated(newFee);
    }

    function updateMinMaxGiftAmount(address tokenAddress, uint256 newMinAmount, uint256 newMaxAmount) external onlyOwner {
        require(newMinAmount <= newMaxAmount, "Min amount cannot exceed max amount");
        minGiftAmountForToken[tokenAddress] = newMinAmount;
        maxGiftAmountForToken[tokenAddress] = newMaxAmount;
        emit MinMaxGiftAmountUpdated(tokenAddress, newMinAmount, newMaxAmount);
    }

    function updateMinMaxEtherGiftAmount(uint256 newMinEtherAmount, uint256 newMaxEtherAmount) external onlyOwner {
        require(newMinEtherAmount <= newMaxEtherAmount, "Min Ether amount cannot exceed max Ether amount");
        minEtherGiftAmount = newMinEtherAmount;
        maxEtherGiftAmount = newMaxEtherAmount;
        emit MinMaxEtherGiftAmountUpdated(newMinEtherAmount, newMaxEtherAmount);
    }

    function updateToken(address newTokenAddress) external onlyOwner {
        require(newTokenAddress != address(0), "Token address cannot be zero");
        token = PodyToken(newTokenAddress);
        whitelistedTokens[newTokenAddress] = true;
        emit TokenUpdated(newTokenAddress);
        emit TokenWhitelisted(newTokenAddress, true);
    }

    function setWhitelistedToken(address tokenAddress, bool isWhitelisted) external onlyOwner {
        require(tokenAddress != address(0), "Token address cannot be zero");
        whitelistedTokens[tokenAddress] = isWhitelisted;
        emit TokenWhitelisted(tokenAddress, isWhitelisted);
    }

    receive() external payable {}
    fallback() external payable {}
}
