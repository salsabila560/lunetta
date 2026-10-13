// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721A, IERC721A} from "erc721a/contracts/ERC721A.sol";
import {ERC721AQueryable} from "erc721a/contracts/extensions/ERC721AQueryable.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title  Lunetta — moon-cat guardians of the floating isles
/// @notice ERC-721A collection with a Merkle whitelist phase, a public phase,
///         per-wallet limits, delayed reveal and ERC-2981 royalties.
/// @dev    Whitelist leaves follow the OpenZeppelin StandardMerkleTree format:
///         leaf = keccak256(bytes.concat(keccak256(abi.encode(address)))).
contract Lunetta is ERC721AQueryable, ERC2981, Ownable2Step, ReentrancyGuard {
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
    }

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error PhaseNotActive();
    error InvalidQuantity();
    error ExceedsMaxSupply();
    error ExceedsWalletLimit();
    error IncorrectPayment();
    error InvalidProof();
    error MetadataIsFrozen();
    error ZeroAddress();
    error WithdrawFailed();
    error NothingToWithdraw();
    error NotRevealed();

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

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    uint256 public immutable maxSupply;

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
    function whitelistMint(uint256 quantity, bytes32[] calldata proof) external payable nonReentrant {
        if (phase != Phase.Whitelist) revert PhaseNotActive();
        if (!isWhitelisted(msg.sender, proof)) revert InvalidProof();
        _checkQuantity(quantity);
        if (whitelistMinted[msg.sender] + quantity > whitelistLimit) revert ExceedsWalletLimit();
        if (msg.value != whitelistPrice * quantity) revert IncorrectPayment();

        whitelistMinted[msg.sender] += quantity;
        _mint(msg.sender, quantity);
    }

    /// @notice Mint during the public phase.
    function publicMint(uint256 quantity) external payable nonReentrant {
        if (phase != Phase.Public) revert PhaseNotActive();
        _checkQuantity(quantity);
        if (publicMinted[msg.sender] + quantity > publicLimit) revert ExceedsWalletLimit();
        if (msg.value != publicPrice * quantity) revert IncorrectPayment();

        publicMinted[msg.sender] += quantity;
        _mint(msg.sender, quantity);
    }

    /// @notice Team / treasury reserve mint. Keep batches small (<= 30) so
    ///         later transfers of tokens deep in a batch stay cheap.
    function ownerMint(address to, uint256 quantity) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        _checkQuantity(quantity);
        _mint(to, quantity);
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

    function withdraw(address payable to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(to, amount);
    }
}
