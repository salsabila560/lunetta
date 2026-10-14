// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721A, IERC721A} from "erc721a/contracts/ERC721A.sol";
import {ERC721AQueryable} from "erc721a/contracts/extensions/ERC721AQueryable.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title  Lunetta — moon-cat guardians of the floating isles
/// @notice ERC-721A collection with a single public mint (no whitelist),
///         a per-wallet limit, delayed reveal and ERC-2981 royalties.
///         Mints are paid in an ERC-20 token (not ETH). Every payment is sent
///         straight from the buyer to the burn address in the same transaction,
///         so the contract and the owner never hold mint proceeds.
contract Lunetta is ERC721AQueryable, ERC2981, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    /// @notice Everything the mint page needs in a single RPC call.
    struct MintState {
        bool mintOpen;
        uint256 price;
        uint256 walletLimit;
        uint256 totalMinted;
        uint256 maxSupply;
        uint256 mintedBy;
        bool revealed;
        address paymentToken;
        uint256 totalBurned;
    }

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error MintClosed();
    error InvalidQuantity();
    error ExceedsMaxSupply();
    error ExceedsWalletLimit();
    error MetadataIsFrozen();
    error ZeroAddress();
    error WithdrawFailed();
    error NothingToWithdraw();
    error NotRevealed();
    error PaymentTokenNotSet();
    error PaymentTokenIsLocked();

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event MintOpenChanged(bool open);
    event PriceUpdated(uint256 price);
    event WalletLimitUpdated(uint256 walletLimit);
    event Revealed(string baseURI);
    event BaseURIUpdated(string baseURI);
    event UnrevealedURIUpdated(string unrevealedURI);
    event MetadataFrozen();
    event Withdrawn(address indexed to, uint256 amount);
    event PaymentTokenUpdated(address indexed token);
    event PaymentTokenLocked(address indexed token);
    event TokensBurned(address indexed minter, uint256 quantity, uint256 amount);
    event TokensRescued(address indexed token, address indexed to, uint256 amount);

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice Where mint payments go. Tokens sent here can never be moved again.
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    uint256 public immutable maxSupply;

    /// @notice ERC-20 used to pay for mints. Prices are in this token's smallest unit.
    IERC20 public paymentToken;
    /// @notice Once true, the payment token can never be changed again.
    bool public paymentTokenLocked;
    /// @notice Total payment tokens burned through minting.
    uint256 public totalBurned;

    /// @notice True while anyone can mint.
    bool public mintOpen;
    /// @notice Price per NFT in the payment token's smallest unit.
    uint256 public price;
    /// @notice Max NFTs one wallet can mint.
    uint256 public walletLimit;

    bool public revealed;
    bool public metadataFrozen;
    string private _baseTokenURI;
    string private _unrevealedURI;

    /// @notice How many NFTs each wallet has minted.
    mapping(address => uint256) public mintedBy;

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        uint256 price_,
        uint256 walletLimit_,
        string memory unrevealedURI_,
        address royaltyReceiver_,
        uint96 royaltyBps_,
        address initialOwner_
    ) ERC721A(name_, symbol_) Ownable(initialOwner_) {
        if (maxSupply_ == 0) revert InvalidQuantity();
        if (royaltyReceiver_ == address(0)) revert ZeroAddress();

        maxSupply = maxSupply_;
        price = price_;
        walletLimit = walletLimit_;
        _unrevealedURI = unrevealedURI_;
        _setDefaultRoyalty(royaltyReceiver_, royaltyBps_);
    }

    // ---------------------------------------------------------------------
    // Minting
    // ---------------------------------------------------------------------

    /// @notice Public mint, open to everyone while `mintOpen` is true.
    /// @dev    The buyer must first approve this contract for `price * quantity` payment tokens,
    ///         which are sent straight to the burn address.
    function mint(uint256 quantity) external nonReentrant {
        if (!mintOpen) revert MintClosed();
        _checkQuantity(quantity);
        if (mintedBy[msg.sender] + quantity > walletLimit) revert ExceedsWalletLimit();

        mintedBy[msg.sender] += quantity;
        _burnPayment(price * quantity, quantity);
        _mint(msg.sender, quantity);
    }

    /// @notice Team / treasury reserve mint. Keep batches small (<= 30) so
    ///         later transfers of tokens deep in a batch stay cheap.
    function ownerMint(address to, uint256 quantity) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        _checkQuantity(quantity);
        _mint(to, quantity);
    }

    /// @dev Moves `amount` payment tokens from the buyer directly to the burn address.
    function _burnPayment(uint256 amount, uint256 quantity) private {
        if (amount == 0) return;
        IERC20 token = paymentToken;
        if (address(token) == address(0)) revert PaymentTokenNotSet();
        token.safeTransferFrom(msg.sender, BURN_ADDRESS, amount);
        totalBurned += amount;
        emit TokensBurned(msg.sender, quantity, amount);
    }

    function _checkQuantity(uint256 quantity) private view {
        if (quantity == 0) revert InvalidQuantity();
        if (_totalMinted() + quantity > maxSupply) revert ExceedsMaxSupply();
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function totalMinted() external view returns (uint256) {
        return _totalMinted();
    }

    function mintState(address account) external view returns (MintState memory s) {
        s.mintOpen = mintOpen;
        s.price = price;
        s.walletLimit = walletLimit;
        s.totalMinted = _totalMinted();
        s.maxSupply = maxSupply;
        s.mintedBy = mintedBy[account];
        s.revealed = revealed;
        s.paymentToken = address(paymentToken);
        s.totalBurned = totalBurned;
    }

    function tokenURI(uint256 tokenId) public view override(ERC721A, IERC721A) returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        if (!revealed) return _unrevealedURI;
        return string.concat(_baseTokenURI, _toString(tokenId), ".json");
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721A, IERC721A, ERC2981)
        returns (bool)
    {
        return ERC721A.supportsInterface(interfaceId) || ERC2981.supportsInterface(interfaceId);
    }

    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }

    // ---------------------------------------------------------------------
    // Owner configuration
    // ---------------------------------------------------------------------

    /// @notice Open or close the public mint.
    function setMintOpen(bool open) external onlyOwner {
        mintOpen = open;
        emit MintOpenChanged(open);
    }

    /// @notice Set the ERC-20 used for mint payments (e.g. once the token launches).
    function setPaymentToken(address token) external onlyOwner {
        if (paymentTokenLocked) revert PaymentTokenIsLocked();
        if (token == address(0)) revert ZeroAddress();
        paymentToken = IERC20(token);
        emit PaymentTokenUpdated(token);
    }

    /// @notice Permanently fix the payment token so it can never be swapped. Irreversible.
    function lockPaymentToken() external onlyOwner {
        if (address(paymentToken) == address(0)) revert PaymentTokenNotSet();
        paymentTokenLocked = true;
        emit PaymentTokenLocked(address(paymentToken));
    }

    /// @notice Price per NFT in the payment token's smallest unit (e.g. 1_000_000e18 for 1,000,000 tokens).
    function setPrice(uint256 newPrice) external onlyOwner {
        price = newPrice;
        emit PriceUpdated(newPrice);
    }

    function setWalletLimit(uint256 newLimit) external onlyOwner {
        walletLimit = newLimit;
        emit WalletLimitUpdated(newLimit);
    }

    function setUnrevealedURI(string calldata newURI) external onlyOwner {
        if (metadataFrozen) revert MetadataIsFrozen();
        _unrevealedURI = newURI;
        emit UnrevealedURIUpdated(newURI);
    }

    /// @notice Reveal the collection. `baseURI` must end with a slash, e.g. ipfs://CID/
    function reveal(string calldata baseURI) external onlyOwner {
        if (metadataFrozen) revert MetadataIsFrozen();
        _baseTokenURI = baseURI;
        revealed = true;
        emit Revealed(baseURI);
    }

    function setBaseURI(string calldata baseURI) external onlyOwner {
        if (metadataFrozen) revert MetadataIsFrozen();
        _baseTokenURI = baseURI;
        emit BaseURIUpdated(baseURI);
    }

    /// @notice Permanently lock metadata. Irreversible.
    function freezeMetadata() external onlyOwner {
        if (!revealed) revert NotRevealed();
        metadataFrozen = true;
        emit MetadataFrozen();
    }

    function setDefaultRoyalty(address receiver, uint96 feeBps) external onlyOwner {
        if (receiver == address(0)) revert ZeroAddress();
        _setDefaultRoyalty(receiver, feeBps);
    }

    /// @notice Recover ERC-20 tokens sent to this contract by mistake. Mint payments never land
    ///         here (they go straight to the burn address), so this cannot touch burned tokens.
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit TokensRescued(token, to, amount);
    }

    /// @notice Recover ETH force-sent to this contract (minting does not accept ETH).
    function withdraw(address payable to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(to, amount);
    }
}
