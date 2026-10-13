"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { WalletButton } from "./WalletButton";

const NAV = [
  { href: "/#world", label: "The world" },
  { href: "/whitelist", label: "Whitelist" },
  { href: "/mint", label: "Mint" },
  { href: "/gallery", label: "Gallery" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
        <Link href="/" className="font-display text-2xl font-bold tracking-tight text-paper" aria-label="Lunetta home">
          Lunetta<span className="text-lantern">.</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className="text-[15px] font-medium text-paper/80 underline-offset-8 hover:text-paper hover:underline aria-[current=page]:text-lantern"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <WalletButton />
          </div>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-paper/60 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7c5-1 11 1 16 0M4 12c6 1 10-1 16 0M4 17c5-1 11 1 16 0" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="mx-5 rounded-3xl border-2 border-ink bg-paper p-5 text-ink shadow-[5px_5px_0_0_#12142B] md:hidden">
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 font-display text-xl font-semibold hover:bg-parchment">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 sm:hidden">
            <WalletButton size="lg" />
          </div>
        </nav>
      )}
    </header>
  );
}
