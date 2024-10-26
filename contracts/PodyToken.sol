// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PodyToken is ERC20 {
    constructor(uint256 supply) ERC20("PodyToken", "PDT") {
        _mint(_msgSender(), supply);
    }
}