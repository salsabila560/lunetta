import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

const CONTRACT_ERRORS: Record<string, string> = {
  MintClosed: "The mint isn't open right now.",
  PaymentTokenNotSet: "Minting opens as soon as the payment token is connected.",
  ERC20InsufficientBalance: "You don't have enough tokens for this mint.",
  ERC20InsufficientAllowance: "Approve the tokens first, then mint again.",
  InvalidQuantity: "Choose at least one Lunetta.",
  ExceedsMaxSupply: "Not enough Lunettas left for that amount.",
  ExceedsWalletLimit: "That would go over your wallet's mint limit.",
  ReentrancyGuardReentrantCall: "Something went wrong. Try again.",
};

/** Turns wallet / RPC / contract errors into one friendly sentence. */
export function friendlyError(err: unknown): string {
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) {
      return "You cancelled the transaction in your wallet.";
    }
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name && CONTRACT_ERRORS[name]) return CONTRACT_ERRORS[name];
    }
    const text = `${err.shortMessage} ${err.details ?? ""}`.toLowerCase();
    if (text.includes("insufficient funds")) return "Your wallet doesn't have enough ETH to pay for gas.";
    if (text.includes("chain mismatch") || text.includes("does not match the target chain")) {
      return "Your wallet is on the wrong network. Switch networks and try again.";
    }
    return err.shortMessage;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Try again.";
}
