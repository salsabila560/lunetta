// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Lunetta} from "../src/Lunetta.sol";

/// @notice Deploys Lunetta using values from the environment.
///
/// forge script script/Deploy.s.sol:Deploy \
///   --rpc-url base_sepolia --account deployer --broadcast --verify
contract Deploy is Script {
    function run() external returns (Lunetta nft) {
        uint256 maxSupply = vm.envOr("MAX_SUPPLY", uint256(1000));
        // Tiered prices in the payment token's smallest unit (18 decimals).
        // Default: #1-100 = 1M, #101-200 = 2M, #201-300 = 5M, #301-1000 = 10M tokens.
        uint256[] memory defEnds = new uint256[](4);
        uint256[] memory defPrices = new uint256[](4);
        (defEnds[0], defEnds[1], defEnds[2], defEnds[3]) = (100, 200, 300, maxSupply);
        (defPrices[0], defPrices[1], defPrices[2], defPrices[3]) =
            (1_000_000 ether, 2_000_000 ether, 5_000_000 ether, 10_000_000 ether);
        uint256[] memory tierEnds = vm.envOr("TIER_ENDS", ",", defEnds);
        uint256[] memory tierPrices = vm.envOr("TIER_PRICES_UNITS", ",", defPrices);
        address paymentToken = vm.envOr("PAYMENT_TOKEN", address(0));
        uint256 walletLimit = vm.envOr("WALLET_LIMIT", uint256(5));
        string memory hiddenURI = vm.envString("UNREVEALED_URI");
        address royaltyReceiver = vm.envAddress("ROYALTY_RECEIVER");
        uint96 royaltyBps = uint96(vm.envOr("ROYALTY_BPS", uint256(500)));
        address initialOwner = vm.envAddress("INITIAL_OWNER");

        require(royaltyBps <= 1000, "royalty > 10%");

        vm.startBroadcast();
        nft = new Lunetta(
            "Lunetta",
            "LUNA",
            maxSupply,
            tierEnds,
            tierPrices,
            walletLimit,
            hiddenURI,
            royaltyReceiver,
            royaltyBps,
            // Deployer stays owner long enough to set the token; transfer to the
            // multisig afterwards with script/TransferOwnership.s.sol.
            msg.sender
        );
        if (paymentToken != address(0)) nft.setPaymentToken(paymentToken);
        if (initialOwner != msg.sender) nft.transferOwnership(initialOwner);
        vm.stopBroadcast();

        console2.log("Lunetta deployed at:", address(nft));
        console2.log("Pending owner (must call acceptOwnership):", initialOwner);
    }
}
