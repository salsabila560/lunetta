// Subset of the Lunetta ABI used by the website (functions + custom errors).
// Full ABI: run `forge build` in /contracts, then `npm run abi`.
export const lunettaAbi = [
  {"inputs":[],"name":"ExceedsMaxSupply","type":"error"},
  {"inputs":[],"name":"ExceedsWalletLimit","type":"error"},
  {"inputs":[],"name":"IncorrectPayment","type":"error"},
  {"inputs":[],"name":"InvalidProof","type":"error"},
  {"inputs":[],"name":"InvalidQuantity","type":"error"},
  {"inputs":[],"name":"MintZeroQuantity","type":"error"},
  {"inputs":[],"name":"PhaseNotActive","type":"error"},
  {"inputs":[],"name":"ReentrancyGuardReentrantCall","type":"error"},
  {"inputs":[],"name":"URIQueryForNonexistentToken","type":"error"},
  {"inputs":[],"name":"maxSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"merkleRoot","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"mintState","outputs":[{"components":[{"internalType":"enum Lunetta.Phase","name":"phase","type":"uint8"},{"internalType":"uint256","name":"whitelistPrice","type":"uint256"},{"internalType":"uint256","name":"publicPrice","type":"uint256"},{"internalType":"uint256","name":"whitelistLimit","type":"uint256"},{"internalType":"uint256","name":"publicLimit","type":"uint256"},{"internalType":"uint256","name":"totalMinted","type":"uint256"},{"internalType":"uint256","name":"maxSupply","type":"uint256"},{"internalType":"uint256","name":"whitelistMintedBy","type":"uint256"},{"internalType":"uint256","name":"publicMintedBy","type":"uint256"},{"internalType":"bool","name":"revealed","type":"bool"}],"internalType":"struct Lunetta.MintState","name":"s","type":"tuple"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"phase","outputs":[{"internalType":"enum Lunetta.Phase","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"quantity","type":"uint256"}],"name":"publicMint","outputs":[],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"tokensOfOwner","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalMinted","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"quantity","type":"uint256"},{"internalType":"bytes32[]","name":"proof","type":"bytes32[]"}],"name":"whitelistMint","outputs":[],"stateMutability":"payable","type":"function"}
] as const;
