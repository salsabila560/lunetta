// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Lunetta} from "../src/Lunetta.sol";
import {IERC721A} from "erc721a/contracts/IERC721A.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

/// Stand-in for the project's ERC-20 (18 decimals).
contract MockToken is ERC20 {
    constructor() ERC20("Mock Lunetta Token", "MLT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract LunettaTest is Test {
    Lunetta internal nft;
    MockToken internal token;

    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    address internal owner = makeAddr("owner");
    address internal royalty = makeAddr("royalty");
    address internal alice = makeAddr("alice"); // whitelisted
    address internal bob = makeAddr("bob"); // whitelisted
    address internal carol = makeAddr("carol"); // whitelisted
    address internal dave = makeAddr("dave"); // whitelisted
    address internal eve = makeAddr("eve"); // NOT whitelisted

    uint256 internal constant MAX_SUPPLY = 20;
    uint256 internal constant WL_PRICE = 500_000 ether; // 500,000 tokens
    uint256 internal constant PUB_PRICE = 1_000_000 ether; // 1,000,000 tokens
    uint256 internal constant WL_LIMIT = 2;
    uint256 internal constant PUB_LIMIT = 3;
    uint256 internal constant START_BALANCE = 100_000_000 ether;
    string internal constant HIDDEN = "ipfs://hidden/hidden.json";

    bytes32[4] internal leaves;
    bytes32 internal root;

    // ------------------------------------------------------------------
    // Merkle helpers (same leaf format as @openzeppelin/merkle-tree)
    // ------------------------------------------------------------------

    function _leaf(address a) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(a))));
    }

    function _hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    /// Tree: root = H( H(l0,l1), H(l2,l3) )
    function _proof(uint256 i) internal view returns (bytes32[] memory p) {
        p = new bytes32[](2);
        if (i == 0) {
            p[0] = leaves[1];
            p[1] = _hashPair(leaves[2], leaves[3]);
        } else if (i == 1) {
            p[0] = leaves[0];
            p[1] = _hashPair(leaves[2], leaves[3]);
        } else if (i == 2) {
            p[0] = leaves[3];
            p[1] = _hashPair(leaves[0], leaves[1]);
        } else {
            p[0] = leaves[2];
            p[1] = _hashPair(leaves[0], leaves[1]);
        }
    }

    function setUp() public {
        leaves = [_leaf(alice), _leaf(bob), _leaf(carol), _leaf(dave)];
        root = _hashPair(_hashPair(leaves[0], leaves[1]), _hashPair(leaves[2], leaves[3]));

        nft = new Lunetta(
            "Lunetta", "LUNA", MAX_SUPPLY, WL_PRICE, PUB_PRICE, WL_LIMIT, PUB_LIMIT, HIDDEN, royalty, 500, owner
        );
        token = new MockToken();

        vm.startPrank(owner);
        nft.setMerkleRoot(root);
        nft.setPaymentToken(address(token));
        vm.stopPrank();

        address[5] memory users = [alice, bob, carol, dave, eve];
        for (uint256 i; i < users.length; ++i) {
            token.mint(users[i], START_BALANCE);
            vm.prank(users[i]);
            token.approve(address(nft), type(uint256).max);
        }
    }

    function _open(Lunetta.Phase p) internal {
        vm.prank(owner);
        nft.setPhase(p);
    }

    // ------------------------------------------------------------------
    // Deployment
    // ------------------------------------------------------------------

    function test_InitialState() public view {
        assertEq(nft.name(), "Lunetta");
        assertEq(nft.symbol(), "LUNA");
        assertEq(nft.maxSupply(), MAX_SUPPLY);
        assertEq(nft.owner(), owner);
        assertEq(uint256(nft.phase()), uint256(Lunetta.Phase.Closed));
        assertEq(nft.whitelistPrice(), WL_PRICE);
        assertEq(nft.publicPrice(), PUB_PRICE);
        assertEq(nft.totalSupply(), 0);
        assertFalse(nft.revealed());
        assertEq(address(nft.paymentToken()), address(token));
        assertEq(nft.BURN_ADDRESS(), DEAD);
        assertEq(nft.totalBurned(), 0);
    }

    function test_RevertWhen_ZeroMaxSupply() public {
        vm.expectRevert(Lunetta.InvalidQuantity.selector);
        new Lunetta("L", "L", 0, 0, 0, 1, 1, HIDDEN, royalty, 500, owner);
    }

    function test_RevertWhen_ZeroRoyaltyReceiver() public {
        vm.expectRevert(Lunetta.ZeroAddress.selector);
        new Lunetta("L", "L", 10, 0, 0, 1, 1, HIDDEN, address(0), 500, owner);
    }

    // ------------------------------------------------------------------
    // Closed phase
    // ------------------------------------------------------------------

    function test_RevertWhen_MintingWhileClosed() public {
        bytes32[] memory p = _proof(0);
        vm.startPrank(alice);
        vm.expectRevert(Lunetta.PhaseNotActive.selector);
        nft.whitelistMint(1, p);
        vm.expectRevert(Lunetta.PhaseNotActive.selector);
        nft.publicMint(1);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Token payment & burn
    // ------------------------------------------------------------------

    function test_PublicMintBurnsTokens() public {
        _open(Lunetta.Phase.Public);
        vm.expectEmit(address(nft));
        emit Lunetta.TokensBurned(eve, 2, PUB_PRICE * 2);
        vm.prank(eve);
        nft.publicMint(2);

        assertEq(nft.balanceOf(eve), 2);
        assertEq(token.balanceOf(eve), START_BALANCE - PUB_PRICE * 2);
        assertEq(token.balanceOf(DEAD), PUB_PRICE * 2);
        assertEq(token.balanceOf(address(nft)), 0, "contract never holds payments");
        assertEq(token.balanceOf(owner), 0, "owner never receives payments");
        assertEq(nft.totalBurned(), PUB_PRICE * 2);
    }

    function test_WhitelistMintBurnsTokens() public {
        _open(Lunetta.Phase.Whitelist);
        vm.prank(alice);
        nft.whitelistMint(2, _proof(0));
        assertEq(token.balanceOf(DEAD), WL_PRICE * 2);
        assertEq(token.balanceOf(address(nft)), 0);
        assertEq(nft.totalBurned(), WL_PRICE * 2);
    }

    function test_TotalBurnedAccumulates() public {
        _open(Lunetta.Phase.Public);
        vm.prank(eve);
        nft.publicMint(1);
        vm.prank(alice);
        nft.publicMint(3);
        assertEq(nft.totalBurned(), PUB_PRICE * 4);
        assertEq(token.balanceOf(DEAD), PUB_PRICE * 4);
    }

    function test_RevertWhen_NotApproved() public {
        _open(Lunetta.Phase.Public);
        address frank = makeAddr("frank");
        token.mint(frank, START_BALANCE);
        vm.prank(frank);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(nft), 0, PUB_PRICE)
        );
        nft.publicMint(1);
        assertEq(nft.balanceOf(frank), 0);
    }

    function test_RevertWhen_InsufficientTokenBalance() public {
        _open(Lunetta.Phase.Public);
        address frank = makeAddr("frank");
        token.mint(frank, PUB_PRICE - 1);
        vm.startPrank(frank);
        token.approve(address(nft), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, frank, PUB_PRICE - 1, PUB_PRICE)
        );
        nft.publicMint(1);
        vm.stopPrank();
    }

    function test_RevertWhen_PaymentTokenNotSet() public {
        Lunetta fresh = new Lunetta("L", "L", 10, 1, 1, 5, 5, HIDDEN, royalty, 500, owner);
        vm.prank(owner);
        fresh.setPhase(Lunetta.Phase.Public);
        vm.prank(eve);
        vm.expectRevert(Lunetta.PaymentTokenNotSet.selector);
        fresh.publicMint(1);
    }

    function test_FreeMintNeedsNoToken() public {
        Lunetta fresh = new Lunetta("L", "L", 10, 0, 0, 5, 5, HIDDEN, royalty, 500, owner);
        vm.prank(owner);
        fresh.setPhase(Lunetta.Phase.Public);
        vm.prank(eve);
        fresh.publicMint(2);
        assertEq(fresh.balanceOf(eve), 2);
        assertEq(fresh.totalBurned(), 0);
    }

    function test_MintDoesNotAcceptEth() public {
        _open(Lunetta.Phase.Public);
        vm.deal(eve, 1 ether);
        vm.prank(eve);
        (bool ok,) = address(nft).call{value: 1 ether}(abi.encodeCall(Lunetta.publicMint, (1)));
        assertFalse(ok);
    }

    function test_SetPaymentToken() public {
        MockToken other = new MockToken();
        vm.expectEmit(address(nft));
        emit Lunetta.PaymentTokenUpdated(address(other));
        vm.prank(owner);
        nft.setPaymentToken(address(other));
        assertEq(address(nft.paymentToken()), address(other));
    }

    function test_RevertWhen_SetPaymentTokenZero() public {
        vm.prank(owner);
        vm.expectRevert(Lunetta.ZeroAddress.selector);
        nft.setPaymentToken(address(0));
    }

    function test_LockPaymentToken() public {
        vm.startPrank(owner);
        nft.lockPaymentToken();
        assertTrue(nft.paymentTokenLocked());
        vm.expectRevert(Lunetta.PaymentTokenIsLocked.selector);
        nft.setPaymentToken(address(0xBEEF));
        vm.stopPrank();
    }

    function test_RevertWhen_LockWithoutToken() public {
        Lunetta fresh = new Lunetta("L", "L", 10, 1, 1, 5, 5, HIDDEN, royalty, 500, owner);
        vm.prank(owner);
        vm.expectRevert(Lunetta.PaymentTokenNotSet.selector);
        fresh.lockPaymentToken();
    }

    function test_RescueERC20() public {
        MockToken stray = new MockToken();
        stray.mint(address(nft), 42 ether);
        vm.prank(owner);
        nft.rescueERC20(address(stray), owner, 42 ether);
        assertEq(stray.balanceOf(owner), 42 ether);
    }

    function testFuzz_BurnEqualsPriceTimesQuantity(uint256 qty, uint256 price) public {
        qty = bound(qty, 1, PUB_LIMIT);
        price = bound(price, 0, START_BALANCE / PUB_LIMIT);
        vm.prank(owner);
        nft.setPrices(0, price);
        _open(Lunetta.Phase.Public);
        vm.prank(eve);
        nft.publicMint(qty);
        assertEq(token.balanceOf(DEAD), price * qty);
        assertEq(token.balanceOf(eve), START_BALANCE - price * qty);
        assertEq(nft.balanceOf(eve), qty);
    }

    // ------------------------------------------------------------------
    // Whitelist phase
    // ------------------------------------------------------------------

    function test_WhitelistMint() public {
        _open(Lunetta.Phase.Whitelist);
        vm.prank(alice);
        nft.whitelistMint(2, _proof(0));

        assertEq(nft.balanceOf(alice), 2);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.ownerOf(2), alice);
        assertEq(nft.whitelistMinted(alice), 2);
    }

    function test_AllWhitelistedAddressesCanMint() public {
        _open(Lunetta.Phase.Whitelist);
        address[4] memory wl = [alice, bob, carol, dave];
        for (uint256 i; i < 4; ++i) {
            vm.prank(wl[i]);
            nft.whitelistMint(1, _proof(i));
            assertEq(nft.balanceOf(wl[i]), 1);
        }
    }

    function test_IsWhitelisted() public view {
        assertTrue(nft.isWhitelisted(alice, _proof(0)));
        assertFalse(nft.isWhitelisted(eve, _proof(0)));
        assertFalse(nft.isWhitelisted(bob, _proof(0)));
    }

    function test_RevertWhen_NotWhitelisted() public {
        _open(Lunetta.Phase.Whitelist);
        bytes32[] memory p = _proof(0);
        vm.prank(eve);
        vm.expectRevert(Lunetta.InvalidProof.selector);
        nft.whitelistMint(1, p);
    }

    function test_RevertWhen_UsingSomeoneElsesProof() public {
        _open(Lunetta.Phase.Whitelist);
        bytes32[] memory p = _proof(0); // alice's proof
        vm.prank(bob);
        vm.expectRevert(Lunetta.InvalidProof.selector);
        nft.whitelistMint(1, p);
    }

    function test_RevertWhen_WhitelistLimitExceeded() public {
        _open(Lunetta.Phase.Whitelist);
        bytes32[] memory p = _proof(0);
        vm.startPrank(alice);
        nft.whitelistMint(2, p);
        vm.expectRevert(Lunetta.ExceedsWalletLimit.selector);
        nft.whitelistMint(1, p);
        vm.stopPrank();
    }

    function test_RevertWhen_ZeroQuantity() public {
        _open(Lunetta.Phase.Whitelist);
        bytes32[] memory p = _proof(0);
        vm.prank(alice);
        vm.expectRevert(Lunetta.InvalidQuantity.selector);
        nft.whitelistMint(0, p);
    }

    function test_RevertWhen_WhitelistMintDuringPublic() public {
        _open(Lunetta.Phase.Public);
        bytes32[] memory p = _proof(0);
        vm.prank(alice);
        vm.expectRevert(Lunetta.PhaseNotActive.selector);
        nft.whitelistMint(1, p);
    }

    // ------------------------------------------------------------------
    // Public phase
    // ------------------------------------------------------------------

    function test_PublicMint() public {
        _open(Lunetta.Phase.Public);
        vm.prank(eve);
        nft.publicMint(3);
        assertEq(nft.balanceOf(eve), 3);
        assertEq(nft.publicMinted(eve), 3);
    }

    function test_WhitelistAndPublicLimitsAreSeparate() public {
        _open(Lunetta.Phase.Whitelist);
        vm.prank(alice);
        nft.whitelistMint(2, _proof(0));

        _open(Lunetta.Phase.Public);
        vm.prank(alice);
        nft.publicMint(3);
        assertEq(nft.balanceOf(alice), 5);
    }

    function test_RevertWhen_PublicMintDuringWhitelist() public {
        _open(Lunetta.Phase.Whitelist);
        vm.prank(eve);
        vm.expectRevert(Lunetta.PhaseNotActive.selector);
        nft.publicMint(1);
    }

    function test_RevertWhen_PublicLimitExceeded() public {
        _open(Lunetta.Phase.Public);
        vm.startPrank(eve);
        nft.publicMint(2);
        vm.expectRevert(Lunetta.ExceedsWalletLimit.selector);
        nft.publicMint(2);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Supply
    // ------------------------------------------------------------------

    function test_RevertWhen_MaxSupplyExceeded() public {
        vm.prank(owner);
        nft.ownerMint(owner, MAX_SUPPLY - 1);

        _open(Lunetta.Phase.Public);
        vm.prank(eve);
        vm.expectRevert(Lunetta.ExceedsMaxSupply.selector);
        nft.publicMint(2);

        vm.prank(eve);
        nft.publicMint(1);
        assertEq(nft.totalSupply(), MAX_SUPPLY);
    }

    function testFuzz_NeverExceedsMaxSupply(uint8 a, uint8 b) public {
        uint256 first = bound(a, 1, MAX_SUPPLY);
        vm.prank(owner);
        nft.ownerMint(owner, first);
        uint256 second = bound(b, 1, 50);
        vm.prank(owner);
        if (first + second > MAX_SUPPLY) {
            vm.expectRevert(Lunetta.ExceedsMaxSupply.selector);
        }
        nft.ownerMint(owner, second);
        assertLe(nft.totalSupply(), MAX_SUPPLY);
    }

    // ------------------------------------------------------------------
    // Owner mint & access control
    // ------------------------------------------------------------------

    function test_OwnerMint() public {
        vm.prank(owner);
        nft.ownerMint(carol, 5);
        assertEq(nft.balanceOf(carol), 5);
        assertEq(nft.totalBurned(), 0, "team mint burns nothing");
    }

    function test_RevertWhen_OwnerMintToZero() public {
        vm.prank(owner);
        vm.expectRevert(Lunetta.ZeroAddress.selector);
        nft.ownerMint(address(0), 1);
    }

    function test_RevertWhen_NonOwnerCallsAdmin() public {
        bytes memory err = abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, eve);
        vm.startPrank(eve);
        vm.expectRevert(err);
        nft.setPhase(Lunetta.Phase.Public);
        vm.expectRevert(err);
        nft.setPrices(0, 0);
        vm.expectRevert(err);
        nft.setLimits(100, 100);
        vm.expectRevert(err);
        nft.setMerkleRoot(bytes32(0));
        vm.expectRevert(err);
        nft.ownerMint(eve, 1);
        vm.expectRevert(err);
        nft.reveal("ipfs://x/");
        vm.expectRevert(err);
        nft.setBaseURI("ipfs://x/");
        vm.expectRevert(err);
        nft.freezeMetadata();
        vm.expectRevert(err);
        nft.setDefaultRoyalty(eve, 1000);
        vm.expectRevert(err);
        nft.withdraw(payable(eve));
        vm.expectRevert(err);
        nft.setPaymentToken(address(token));
        vm.expectRevert(err);
        nft.lockPaymentToken();
        vm.expectRevert(err);
        nft.rescueERC20(address(token), eve, 1);
        vm.stopPrank();
    }

    function test_AdminSetters() public {
        vm.startPrank(owner);
        nft.setPrices(1, 2);
        nft.setLimits(7, 8);
        nft.setMerkleRoot(bytes32(uint256(1)));
        vm.stopPrank();
        assertEq(nft.whitelistPrice(), 1);
        assertEq(nft.publicPrice(), 2);
        assertEq(nft.whitelistLimit(), 7);
        assertEq(nft.publicLimit(), 8);
        assertEq(nft.merkleRoot(), bytes32(uint256(1)));
    }

    function test_TwoStepOwnershipTransfer() public {
        address multisig = makeAddr("multisig");
        vm.prank(owner);
        nft.transferOwnership(multisig);
        assertEq(nft.owner(), owner); // not yet
        assertEq(nft.pendingOwner(), multisig);

        vm.prank(multisig);
        nft.acceptOwnership();
        assertEq(nft.owner(), multisig);
    }

    // ------------------------------------------------------------------
    // Reveal & metadata
    // ------------------------------------------------------------------

    function test_UnrevealedTokenURI() public {
        vm.prank(owner);
        nft.ownerMint(alice, 2);
        assertEq(nft.tokenURI(1), HIDDEN);
        assertEq(nft.tokenURI(2), HIDDEN);
    }

    function test_Reveal() public {
        vm.startPrank(owner);
        nft.ownerMint(alice, 12);
        nft.reveal("ipfs://bafyreal/");
        vm.stopPrank();
        assertTrue(nft.revealed());
        assertEq(nft.tokenURI(1), "ipfs://bafyreal/1.json");
        assertEq(nft.tokenURI(12), "ipfs://bafyreal/12.json");
    }

    function test_RevertWhen_TokenURIForNonexistentToken() public {
        vm.expectRevert(IERC721A.URIQueryForNonexistentToken.selector);
        nft.tokenURI(1);
    }

    function test_FreezeMetadata() public {
        vm.startPrank(owner);
        vm.expectRevert(Lunetta.NotRevealed.selector);
        nft.freezeMetadata();

        nft.reveal("ipfs://a/");
        nft.freezeMetadata();
        assertTrue(nft.metadataFrozen());

        vm.expectRevert(Lunetta.MetadataIsFrozen.selector);
        nft.setBaseURI("ipfs://b/");
        vm.expectRevert(Lunetta.MetadataIsFrozen.selector);
        nft.reveal("ipfs://b/");
        vm.expectRevert(Lunetta.MetadataIsFrozen.selector);
        nft.setUnrevealedURI("ipfs://c");
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Royalties & interfaces
    // ------------------------------------------------------------------

    function test_RoyaltyInfo() public {
        (address recv, uint256 amt) = nft.royaltyInfo(1, 1 ether);
        assertEq(recv, royalty);
        assertEq(amt, 0.05 ether);

        vm.prank(owner);
        nft.setDefaultRoyalty(alice, 250);
        (recv, amt) = nft.royaltyInfo(1, 1 ether);
        assertEq(recv, alice);
        assertEq(amt, 0.025 ether);
    }

    function test_SupportsInterface() public view {
        assertTrue(nft.supportsInterface(0x01ffc9a7)); // ERC165
        assertTrue(nft.supportsInterface(0x80ac58cd)); // ERC721
        assertTrue(nft.supportsInterface(0x5b5e139f)); // ERC721Metadata
        assertTrue(nft.supportsInterface(0x2a55205a)); // ERC2981
        assertFalse(nft.supportsInterface(0xffffffff));
    }

    // ------------------------------------------------------------------
    // Withdraw (only for ETH force-sent by mistake)
    // ------------------------------------------------------------------

    function test_RevertWhen_WithdrawNothing() public {
        vm.prank(owner);
        vm.expectRevert(Lunetta.NothingToWithdraw.selector);
        nft.withdraw(payable(owner));
    }

    function test_WithdrawForcedEth() public {
        vm.deal(address(nft), 1 ether);
        address treasury = makeAddr("treasury");
        vm.prank(owner);
        nft.withdraw(payable(treasury));
        assertEq(treasury.balance, 1 ether);
    }

    // ------------------------------------------------------------------
    // Frontend helpers
    // ------------------------------------------------------------------

    function test_TokensOfOwnerAndMintState() public {
        _open(Lunetta.Phase.Whitelist);
        vm.prank(alice);
        nft.whitelistMint(1, _proof(0));
        vm.prank(owner);
        nft.ownerMint(bob, 2);
        vm.prank(alice);
        nft.whitelistMint(1, _proof(0));

        uint256[] memory ids = nft.tokensOfOwner(alice);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 4);

        Lunetta.MintState memory s = nft.mintState(alice);
        assertEq(uint256(s.phase), uint256(Lunetta.Phase.Whitelist));
        assertEq(s.totalMinted, 4);
        assertEq(s.maxSupply, MAX_SUPPLY);
        assertEq(s.whitelistMintedBy, 2);
        assertEq(s.publicMintedBy, 0);
        assertEq(s.paymentToken, address(token));
        assertEq(s.totalBurned, WL_PRICE * 2);
    }

    function test_EmitsPhaseChanged() public {
        vm.expectEmit(address(nft));
        emit Lunetta.PhaseChanged(Lunetta.Phase.Public);
        _open(Lunetta.Phase.Public);
    }
}
