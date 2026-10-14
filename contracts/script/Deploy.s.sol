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
        // Prices are in the payment token's smallest unit (18 decimals: 1_000_000e18 = 1,000,000 tokens).
        uint256 price = vm.envOr("PRICE_UNITS", uint256(1_000_000 ether));
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
            price,
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
