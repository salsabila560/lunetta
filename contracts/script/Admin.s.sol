// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Lunetta} from "../src/Lunetta.sol";

/// @notice Owner actions for testnet (or while the deployer is still owner).
///         On mainnet the owner is a Safe multisig: run the same calls from the
///         Safe Transaction Builder instead (see docs/LAUNCH_GUIDE.md).
///
/// forge script script/Admin.s.sol:SetPhase --sig "run(uint8)" 1 --rpc-url base_sepolia --account deployer --broadcast
contract SetPhase is Script {
    function run(uint8 phase) external {
        Lunetta nft = Lunetta(vm.envAddress("LUNETTA_ADDRESS"));
        vm.broadcast();
        nft.setPhase(Lunetta.Phase(phase));
        console2.log("Phase set to", phase);
    }
}

/// forge script script/Admin.s.sol:SetMerkleRoot --sig "run(bytes32)" 0x... --rpc-url base_sepolia --account deployer --broadcast
contract SetMerkleRoot is Script {
    function run(bytes32 root) external {
        Lunetta nft = Lunetta(vm.envAddress("LUNETTA_ADDRESS"));
        vm.broadcast();
        nft.setMerkleRoot(root);
        console2.logBytes32(root);
    }
}

/// forge script script/Admin.s.sol:Reveal --sig "run(string)" "ipfs://CID/" --rpc-url base_sepolia --account deployer --broadcast
contract Reveal is Script {
    function run(string calldata baseURI) external {
        Lunetta nft = Lunetta(vm.envAddress("LUNETTA_ADDRESS"));
        vm.broadcast();
        nft.reveal(baseURI);
        console2.log("Revealed with", baseURI);
    }
}

/// forge script script/Admin.s.sol:OwnerMint --sig "run(address,uint256)" 0xTo 10 --rpc-url base_sepolia --account deployer --broadcast
contract OwnerMint is Script {
    function run(address to, uint256 quantity) external {
        Lunetta nft = Lunetta(vm.envAddress("LUNETTA_ADDRESS"));
        vm.broadcast();
        nft.ownerMint(to, quantity);
    }
}

/// Set the ERC-20 that mints are paid in (payments are burned to 0x...dEaD).
/// forge script script/Admin.s.sol:SetPaymentToken --sig "run(address)" 0xToken --rpc-url robinhood --account deployer --broadcast
contract SetPaymentToken is Script {
    function run(address token) external {
        Lunetta nft = Lunetta(vm.envAddress("LUNETTA_ADDRESS"));
        vm.broadcast();
        nft.setPaymentToken(token);
        console2.log("Payment token set to", token);
    }
}
