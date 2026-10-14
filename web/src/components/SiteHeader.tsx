"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { siteConfig } from "@/lib/config";
import { WalletButton } from "./WalletButton";

const NAV = [
  { href: "/#world", label: "The world" },
  { href: "/play", label: "Play" },
  { href: "/mint", label: "Mint" },
  { href: "/gallery", label: "Gallery" },
];

function XIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.2h1.7L7.4 4.72H5.58L16.67 19.2Z" />
    </svg>
  );
}

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
          {siteConfig.xUrl && (
            <a
              href={siteConfig.xUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Lunetta on X"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-paper/50 text-paper/85 hover:border-lantern hover:text-lantern"
            >
              <XIcon />
            </a>
          )}
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
          {siteConfig.xUrl && (
            <a
              href={siteConfig.xUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center gap-2 rounded-xl px-3 py-3 font-display text-xl font-semibold hover:bg-parchment"
            >
              <XIcon className="h-5 w-5" /> @lunettacats
            </a>
          )}
          <div className="mt-4 sm:hidden">
            <WalletButton size="lg" />
          </div>
        </nav>
      )}
    </header>
  );
}
