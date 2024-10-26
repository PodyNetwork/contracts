// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./PodyToken.sol";

contract PodyGift is Ownable2Step {
    PodyToken public token;
    uint256 public commissionFee;
    uint256 public minGiftAmount;

    event GiftSent(address indexed sender, address indexed recipient, uint256 amountSent, uint256 commission);
    event FeeUpdated(uint256 newFee);
    event MinGiftAmountUpdated(uint256 newMinAmount);
    event TokenUpdated(address newTokenAddress);

    constructor(address tokenAddress, uint256 initialFee, uint256 initialMinGiftAmount) Ownable(msg.sender) {
        token = PodyToken(tokenAddress);
        commissionFee = initialFee;
        minGiftAmount = initialMinGiftAmount;
    }

    function giftTokens(address recipient, uint256 amount) external {
        require(amount >= minGiftAmount, "Amount must be at least the minimum gift amount");

        uint256 commission = (amount * commissionFee) / 10000;
        uint256 amountAfterCommission = amount - commission;

        token.transferFrom(msg.sender, recipient, amountAfterCommission);
        token.transferFrom(msg.sender, owner(), commission);

        emit GiftSent(msg.sender, recipient, amountAfterCommission, commission);
    }

    function updateCommissionFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee cannot exceed 10%");
        commissionFee = newFee;
        emit FeeUpdated(newFee);
    }

    function updateMinGiftAmount(uint256 newMinAmount) external onlyOwner {
        minGiftAmount = newMinAmount;
        emit MinGiftAmountUpdated(newMinAmount);
    }

    function updateToken(address newTokenAddress) external onlyOwner {
        token = PodyToken(newTokenAddress);
        emit TokenUpdated(newTokenAddress);
    }
}
