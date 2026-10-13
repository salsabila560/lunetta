"use client";

import { useState } from "react";
import { chainConfig } from "@/lib/config";

function shorten(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ContractAddress() {
  const [copied, setCopied] = useState(false);
  const address = chainConfig.contractAddress;

  if (!chainConfig.isContractConfigured) {
    return (
      <div className="inline-flex items-center gap-3 rounded-full border-2 border-paper/40 px-5 py-2.5 text-sm text-paper/80">
        <span className="font-semibold text-lantern">CA</span>
        Revealed at launch
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-full border-2 border-paper/40 bg-ink/40 py-1.5 pl-5 pr-1.5 backdrop-blur-sm">
      <span className="text-sm font-semibold text-lantern">CA</span>
      <code className="font-mono text-sm text-paper sm:hidden" title={address}>{shorten(address)}</code>
      <code className="hidden truncate font-mono text-sm text-paper sm:inline">{address}</code>
      <button
        type="button"
        onClick={copy}
        className="ml-1 inline-flex h-10 min-w-[84px] items-center justify-center rounded-full border-2 border-ink bg-paper px-4 text-sm font-semibold text-ink"
        aria-label="Copy contract address"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <span className="sr-only" aria-live="polite">{copied ? "Contract address copied" : ""}</span>
    </div>
  );
}
