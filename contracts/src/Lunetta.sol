// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721A, IERC721A} from "erc721a/contracts/ERC721A.sol";
import {ERC721AQueryable} from "erc721a/contracts/extensions/ERC721AQueryable.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title  Lunetta — moon-cat guardians of the floating isles
/// @notice ERC-721A collection with a Merkle whitelist phase, a public phase,
///         per-wallet limits, delayed reveal and ERC-2981 royalties.
///         Mints are paid in an ERC-20 token (not ETH). Every payment is sent
///         straight from the buyer to the burn address in the same transaction,
///         so the contract and the owner never hold mint proceeds.
/// @dev    Whitelist leaves follow the OpenZeppelin StandardMerkleTree format:
///         leaf = keccak256(bytes.concat(keccak256(abi.encode(address)))).
contract Lunetta is ERC721AQueryable, ERC2981, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum Phase {
        Closed,
        Whitelist,
        Public
    }

    /// @notice Everything the mint page needs in a single RPC call.
    struct MintState {
        Phase phase;
        uint256 whitelistPrice;
        uint256 publicPrice;
        uint256 whitelistLimit;
        uint256 publicLimit;
        uint256 totalMinted;
        uint256 maxSupply;
        uint256 whitelistMintedBy;
        uint256 publicMintedBy;
        bool revealed;
        address paymentToken;
        uint256 totalBurned;
    }

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error PhaseNotActive();
    error InvalidQuantity();
    error ExceedsMaxSupply();
    error ExceedsWalletLimit();
    error InvalidProof();
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

    event PhaseChanged(Phase phase);
    event PricesUpdated(uint256 whitelistPrice, uint256 publicPrice);
    event LimitsUpdated(uint256 whitelistLimit, uint256 publicLimit);
    event MerkleRootUpdated(bytes32 merkleRoot);
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

    Phase public phase;
    uint256 public whitelistPrice;
    uint256 public publicPrice;
    uint256 public whitelistLimit;
    uint256 public publicLimit;
    bytes32 public merkleRoot;

    bool public revealed;
    bool public metadataFrozen;
    string private _baseTokenURI;
    string private _unrevealedURI;

    mapping(address => uint256) public whitelistMinted;
    mapping(address => uint256) public publicMinted;

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        uint256 whitelistPrice_,
        uint256 publicPrice_,
        uint256 whitelistLimit_,
        uint256 publicLimit_,
        string memory unrevealedURI_,
        address royaltyReceiver_,
        uint96 royaltyBps_,
        address initialOwner_
    ) ERC721A(name_, symbol_) Ownable(initialOwner_) {
        if (maxSupply_ == 0) revert InvalidQuantity();
        if (royaltyReceiver_ == address(0)) revert ZeroAddress();

        maxSupply = maxSupply_;
        whitelistPrice = whitelistPrice_;
        publicPrice = publicPrice_;
        whitelistLimit = whitelistLimit_;
        publicLimit = publicLimit_;
        _unrevealedURI = unrevealedURI_;
        _setDefaultRoyalty(royaltyReceiver_, royaltyBps_);
    }

    // ---------------------------------------------------------------------
    // Minting
    // ---------------------------------------------------------------------

    /// @notice Mint during the whitelist phase.
    /// @param quantity Number of tokens to mint.
    /// @param proof    Merkle proof for msg.sender.
    /// @dev    The buyer must first approve this contract for `whitelistPrice * quantity` payment tokens.
    function whitelistMint(uint256 quantity, bytes32[] calldata proof) external nonReentrant {
        if (phase != Phase.Whitelist) revert PhaseNotActive();
        if (!isWhitelisted(msg.sender, proof)) revert InvalidProof();
        _checkQuantity(quantity);
        if (whitelistMinted[msg.sender] + quantity > whitelistLimit) revert ExceedsWalletLimit();

        whitelistMinted[msg.sender] += quantity;
        _burnPayment(whitelistPrice * quantity, quantity);
        _mint(msg.sender, quantity);
    }

    /// @notice Mint during the public phase.
    /// @dev    The buyer must first approve this contract for `publicPrice * quantity` payment tokens.
    function publicMint(uint256 quantity) external nonReentrant {
        if (phase != Phase.Public) revert PhaseNotActive();
        _checkQuantity(quantity);
        if (publicMinted[msg.sender] + quantity > publicLimit) revert ExceedsWalletLimit();

        publicMinted[msg.sender] += quantity;
        _burnPayment(publicPrice * quantity, quantity);
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

    function isWhitelisted(address account, bytes32[] calldata proof) public view returns (bool) {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(account))));
        return MerkleProof.verifyCalldata(proof, merkleRoot, leaf);
    }

    function totalMinted() external view returns (uint256) {
        return _totalMinted();
    }

    function mintState(address account) external view returns (MintState memory s) {
        s.phase = phase;
        s.whitelistPrice = whitelistPrice;
        s.publicPrice = publicPrice;
        s.whitelistLimit = whitelistLimit;
        s.publicLimit = publicLimit;
        s.totalMinted = _totalMinted();
        s.maxSupply = maxSupply;
        s.whitelistMintedBy = whitelistMinted[account];
        s.publicMintedBy = publicMinted[account];
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

    function setPhase(Phase newPhase) external onlyOwner {
        phase = newPhase;
        emit PhaseChanged(newPhase);
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

    /// @notice Prices are in the payment token's smallest unit (e.g. 1_000_000e18 for 1,000,000 tokens).
    function setPrices(uint256 newWhitelistPrice, uint256 newPublicPrice) external onlyOwner {
        whitelistPrice = newWhitelistPrice;
        publicPrice = newPublicPrice;
        emit PricesUpdated(newWhitelistPrice, newPublicPrice);
    }

    function setLimits(uint256 newWhitelistLimit, uint256 newPublicLimit) external onlyOwner {
        whitelistLimit = newWhitelistLimit;
        publicLimit = newPublicLimit;
        emit LimitsUpdated(newWhitelistLimit, newPublicLimit);
    }

    function setMerkleRoot(bytes32 newRoot) external onlyOwner {
        merkleRoot = newRoot;
        emit MerkleRootUpdated(newRoot);
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
