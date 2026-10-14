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
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave = makeAddr("dave");
    address internal eve = makeAddr("eve");

    uint256 internal constant MAX_SUPPLY = 20;
    uint256 internal constant PUB_PRICE = 1_000_000 ether; // tier 1: 1,000,000 tokens
    uint256 internal constant P2 = 2_000_000 ether;
    uint256 internal constant P3 = 5_000_000 ether;
    uint256 internal constant P4 = 10_000_000 ether;
    uint256 internal constant PUB_LIMIT = 3;
    uint256 internal constant START_BALANCE = 100_000_000 ether;
    string internal constant HIDDEN = "ipfs://hidden/hidden.json";

    /// Scaled-down version of the real schedule: #1-5, #6-10, #11-15, #16-20.
    function _tiers() internal pure returns (uint256[] memory ends, uint256[] memory prices) {
        ends = new uint256[](4);
        prices = new uint256[](4);
        (ends[0], ends[1], ends[2], ends[3]) = (5, 10, 15, MAX_SUPPLY);
        (prices[0], prices[1], prices[2], prices[3]) = (PUB_PRICE, P2, P3, P4);
    }

    function _flat(uint256 max, uint256 p) internal pure returns (uint256[] memory ends, uint256[] memory prices) {
        ends = new uint256[](1);
        prices = new uint256[](1);
        ends[0] = max;
        prices[0] = p;
    }

    function setUp() public {
        (uint256[] memory ends, uint256[] memory prices) = _tiers();
        nft = new Lunetta("Lunetta", "LUNA", MAX_SUPPLY, ends, prices, PUB_LIMIT, HIDDEN, royalty, 500, owner);
        token = new MockToken();

        vm.startPrank(owner);
        nft.setPaymentToken(address(token));
        vm.stopPrank();

        address[5] memory users = [alice, bob, carol, dave, eve];
        for (uint256 i; i < users.length; ++i) {
            token.mint(users[i], START_BALANCE);
            vm.prank(users[i]);
            token.approve(address(nft), type(uint256).max);
        }
    }

    function _newFlat(uint256 max, uint256 p, uint256 limit, string memory hidden, address roy, uint96 bps, address own)
        internal
        returns (Lunetta)
    {
        (uint256[] memory ends, uint256[] memory prices) = _flat(max == 0 ? 1 : max, p);
        return new Lunetta("L", "L", max, ends, prices, limit, hidden, roy, bps, own);
    }

    function _open() internal {
        vm.prank(owner);
        nft.setMintOpen(true);
    }

    // ------------------------------------------------------------------
    // Deployment
    // ------------------------------------------------------------------

    function test_InitialState() public view {
        assertEq(nft.name(), "Lunetta");
        assertEq(nft.symbol(), "LUNA");
        assertEq(nft.maxSupply(), MAX_SUPPLY);
        assertEq(nft.owner(), owner);
        assertFalse(nft.mintOpen());
        assertEq(nft.currentPrice(), PUB_PRICE);
        assertEq(nft.walletLimit(), PUB_LIMIT);
        assertEq(nft.totalSupply(), 0);
        assertFalse(nft.revealed());
        assertEq(address(nft.paymentToken()), address(token));
        assertEq(nft.BURN_ADDRESS(), DEAD);
        assertEq(nft.totalBurned(), 0);
    }

    function test_RevertWhen_ZeroMaxSupply() public {
        vm.expectRevert(Lunetta.InvalidQuantity.selector);
        _newFlat(0, 0, 1, HIDDEN, royalty, 500, owner);
    }

    function test_RevertWhen_ZeroRoyaltyReceiver() public {
        vm.expectRevert(Lunetta.ZeroAddress.selector);
        _newFlat(10, 0, 1, HIDDEN, address(0), 500, owner);
    }

    // ------------------------------------------------------------------
    // Closed phase
    // ------------------------------------------------------------------

    function test_RevertWhen_MintingWhileClosed() public {
        vm.prank(alice);
        vm.expectRevert(Lunetta.MintClosed.selector);
        nft.mint(1);
    }

    function test_CloseMintAgain() public {
        _open();
        vm.prank(alice);
        nft.mint(1);
        vm.prank(owner);
        nft.setMintOpen(false);
        vm.prank(alice);
        vm.expectRevert(Lunetta.MintClosed.selector);
        nft.mint(1);
    }

    // ------------------------------------------------------------------
    // Token payment & burn
    // ------------------------------------------------------------------

    function test_PublicMintBurnsTokens() public {
        _open();
        vm.expectEmit(address(nft));
        emit Lunetta.TokensBurned(eve, 2, PUB_PRICE * 2);
        vm.prank(eve);
        nft.mint(2);

        assertEq(nft.balanceOf(eve), 2);
        assertEq(token.balanceOf(eve), START_BALANCE - PUB_PRICE * 2);
        assertEq(token.balanceOf(DEAD), PUB_PRICE * 2);
        assertEq(token.balanceOf(address(nft)), 0, "contract never holds payments");
        assertEq(token.balanceOf(owner), 0, "owner never receives payments");
        assertEq(nft.totalBurned(), PUB_PRICE * 2);
    }

    function test_TotalBurnedAccumulates() public {
        _open();
        vm.prank(eve);
        nft.mint(1);
        vm.prank(alice);
        nft.mint(3);
        assertEq(nft.totalBurned(), PUB_PRICE * 4);
        assertEq(token.balanceOf(DEAD), PUB_PRICE * 4);
    }

    function test_RevertWhen_NotApproved() public {
        _open();
        address frank = makeAddr("frank");
        token.mint(frank, START_BALANCE);
        vm.prank(frank);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(nft), 0, PUB_PRICE)
        );
        nft.mint(1);
        assertEq(nft.balanceOf(frank), 0);
    }

    function test_RevertWhen_InsufficientTokenBalance() public {
        _open();
        address frank = makeAddr("frank");
        token.mint(frank, PUB_PRICE - 1);
        vm.startPrank(frank);
        token.approve(address(nft), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, frank, PUB_PRICE - 1, PUB_PRICE)
        );
        nft.mint(1);
        vm.stopPrank();
    }

    function test_RevertWhen_PaymentTokenNotSet() public {
        Lunetta fresh = _newFlat(10, 1, 5, HIDDEN, royalty, 500, owner);
        vm.prank(owner);
        fresh.setMintOpen(true);
        vm.prank(eve);
        vm.expectRevert(Lunetta.PaymentTokenNotSet.selector);
        fresh.mint(1);
    }

    function test_FreeMintNeedsNoToken() public {
        Lunetta fresh = _newFlat(10, 0, 5, HIDDEN, royalty, 500, owner);
        vm.prank(owner);
        fresh.setMintOpen(true);
        vm.prank(eve);
        fresh.mint(2);
        assertEq(fresh.balanceOf(eve), 2);
        assertEq(fresh.totalBurned(), 0);
    }

    function test_MintDoesNotAcceptEth() public {
        _open();
        vm.deal(eve, 1 ether);
        vm.prank(eve);
        (bool ok,) = address(nft).call{value: 1 ether}(abi.encodeCall(Lunetta.mint, (1)));
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
        Lunetta fresh = _newFlat(10, 1, 5, HIDDEN, royalty, 500, owner);
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
        (uint256[] memory ends, uint256[] memory prices) = _flat(MAX_SUPPLY, price);
        vm.prank(owner);
        nft.setPriceTiers(ends, prices);
        _open();
        vm.prank(eve);
        nft.mint(qty);
        assertEq(token.balanceOf(DEAD), price * qty);
        assertEq(token.balanceOf(eve), START_BALANCE - price * qty);
        assertEq(nft.balanceOf(eve), qty);
    }

    // ------------------------------------------------------------------
    // Public mint
    // ------------------------------------------------------------------

    function test_PublicMint() public {
        _open();
        vm.prank(eve);
        nft.mint(3);
        assertEq(nft.balanceOf(eve), 3);
        assertEq(nft.mintedBy(eve), 3);
        assertEq(nft.ownerOf(1), eve);
        assertEq(nft.ownerOf(3), eve);
    }

    function test_AnyoneCanMint() public {
        _open();
        address[5] memory users = [alice, bob, carol, dave, eve];
        for (uint256 i; i < users.length; ++i) {
            vm.prank(users[i]);
            nft.mint(1);
            assertEq(nft.balanceOf(users[i]), 1);
        }
    }

    function test_RevertWhen_ZeroQuantity() public {
        _open();
        vm.prank(alice);
        vm.expectRevert(Lunetta.InvalidQuantity.selector);
        nft.mint(0);
    }

    function test_RevertWhen_PublicLimitExceeded() public {
        _open();
        vm.startPrank(eve);
        nft.mint(2);
        vm.expectRevert(Lunetta.ExceedsWalletLimit.selector);
        nft.mint(2);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Tiered pricing
    // ------------------------------------------------------------------

    function test_QuoteWithinFirstTier() public view {
        assertEq(nft.quote(1), PUB_PRICE);
        assertEq(nft.quote(5), PUB_PRICE * 5);
    }

    function test_QuoteAcrossTiers() public view {
        // #1-5 @1M, #6-10 @2M, #11-12 @5M
        assertEq(nft.quote(12), PUB_PRICE * 5 + P2 * 5 + P3 * 2);
        assertEq(nft.quote(MAX_SUPPLY), PUB_PRICE * 5 + P2 * 5 + P3 * 5 + P4 * 5);
    }

    function test_PriceRisesAsSupplyIsMinted() public {
        vm.prank(owner);
        nft.ownerMint(owner, 4); // #1-4
        assertEq(nft.currentPrice(), PUB_PRICE);
        // next 3 = #5 @1M + #6,#7 @2M
        assertEq(nft.quote(3), PUB_PRICE + P2 * 2);

        _open();
        vm.prank(eve);
        nft.mint(3);
        assertEq(token.balanceOf(DEAD), PUB_PRICE + P2 * 2, "burn follows the tiers");
        assertEq(nft.currentPrice(), P2); // #8

        vm.prank(owner);
        nft.ownerMint(owner, 3); // #8-10
        assertEq(nft.currentPrice(), P3); // #11
        vm.prank(owner);
        nft.ownerMint(owner, 5); // #11-15
        assertEq(nft.currentPrice(), P4); // #16
        assertEq(nft.mintState(eve).price, P4);
    }

    function test_MintStatePriceZeroWhenSoldOut() public {
        vm.prank(owner);
        nft.ownerMint(owner, MAX_SUPPLY);
        assertEq(nft.mintState(eve).price, 0);
    }

    function test_PriceTiersView() public view {
        (uint256[] memory ends, uint256[] memory prices) = nft.priceTiers();
        assertEq(ends.length, 4);
        assertEq(ends[3], MAX_SUPPLY);
        assertEq(prices[0], PUB_PRICE);
        assertEq(prices[3], P4);
    }

    function test_RevertWhen_InvalidTiers() public {
        uint256[] memory ends = new uint256[](2);
        uint256[] memory prices = new uint256[](2);
        vm.startPrank(owner);
        // not increasing
        (ends[0], ends[1]) = (10, 10);
        vm.expectRevert(Lunetta.InvalidPriceTiers.selector);
        nft.setPriceTiers(ends, prices);
        // does not cover max supply
        (ends[0], ends[1]) = (5, MAX_SUPPLY - 1);
        vm.expectRevert(Lunetta.InvalidPriceTiers.selector);
        nft.setPriceTiers(ends, prices);
        // length mismatch
        uint256[] memory one = new uint256[](1);
        (ends[0], ends[1]) = (5, MAX_SUPPLY);
        vm.expectRevert(Lunetta.InvalidPriceTiers.selector);
        nft.setPriceTiers(ends, one);
        // empty
        vm.expectRevert(Lunetta.InvalidPriceTiers.selector);
        nft.setPriceTiers(new uint256[](0), new uint256[](0));
        vm.stopPrank();
    }

    function testFuzz_QuoteEqualsSumOfSingles(uint8 premint, uint8 qty) public {
        uint256 pre = bound(premint, 0, MAX_SUPPLY - 1);
        uint256 q = bound(qty, 1, MAX_SUPPLY - pre);
        if (pre > 0) {
            vm.prank(owner);
            nft.ownerMint(owner, pre);
        }
        uint256 expected;
        for (uint256 n = pre + 1; n <= pre + q; ++n) {
            expected += n <= 5 ? PUB_PRICE : n <= 10 ? P2 : n <= 15 ? P3 : P4;
        }
        assertEq(nft.quote(q), expected);
    }

    // ------------------------------------------------------------------
    // Supply
    // ------------------------------------------------------------------

    function test_RevertWhen_MaxSupplyExceeded() public {
        vm.prank(owner);
        nft.ownerMint(owner, MAX_SUPPLY - 1);

        _open();
        vm.prank(eve);
        vm.expectRevert(Lunetta.ExceedsMaxSupply.selector);
        nft.mint(2);

        vm.prank(eve);
        nft.mint(1);
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
        nft.setMintOpen(true);
        (uint256[] memory e, uint256[] memory pr) = _flat(MAX_SUPPLY, 0);
        vm.expectRevert(err);
        nft.setPriceTiers(e, pr);
        vm.expectRevert(err);
        nft.setWalletLimit(100);
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
        (uint256[] memory e, uint256[] memory pr) = _flat(MAX_SUPPLY, 2);
        nft.setPriceTiers(e, pr);
        nft.setWalletLimit(8);
        vm.stopPrank();
        assertEq(nft.currentPrice(), 2);
        assertEq(nft.walletLimit(), 8);
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
        _open();
        vm.prank(alice);
        nft.mint(1);
        vm.prank(owner);
        nft.ownerMint(bob, 2);
        vm.prank(alice);
        nft.mint(1);

        uint256[] memory ids = nft.tokensOfOwner(alice);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 4);

        Lunetta.MintState memory s = nft.mintState(alice);
        assertTrue(s.mintOpen);
        assertEq(s.price, PUB_PRICE);
        assertEq(s.walletLimit, PUB_LIMIT);
        assertEq(s.totalMinted, 4);
        assertEq(s.maxSupply, MAX_SUPPLY);
        assertEq(s.mintedBy, 2);
        assertEq(s.paymentToken, address(token));
        assertEq(s.totalBurned, PUB_PRICE * 2);
    }

    function test_EmitsMintOpenChanged() public {
        vm.expectEmit(address(nft));
        emit Lunetta.MintOpenChanged(true);
        _open();
    }
}
