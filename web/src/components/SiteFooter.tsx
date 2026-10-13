import Link from "next/link";
import { chainConfig, explorerAddress, siteConfig } from "@/lib/config";
import { InkDivider } from "./illustrations";

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.2h1.7L7.4 4.72H5.58L16.67 19.2Z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M19.6 5.3A16.6 16.6 0 0 0 15.5 4l-.5 1a15.3 15.3 0 0 0-6 0L8.5 4a16.6 16.6 0 0 0-4.1 1.3C1.8 9.2 1.1 13 1.5 16.8a16.8 16.8 0 0 0 5 2.5l1.1-1.7a10.8 10.8 0 0 1-1.7-.8l.4-.3a11.9 11.9 0 0 0 11.4 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.7a16.7 16.7 0 0 0 5-2.5c.5-4.4-.8-8.2-2.9-11.5ZM8.7 14.6c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
    </svg>
  );
}

export function SiteFooter() {
  const socials = [
    { href: siteConfig.xUrl, label: "Lunetta on X", icon: <XIcon /> },
    { href: siteConfig.discordUrl, label: "Join the Lunetta Discord", icon: <DiscordIcon /> },
  ].filter((s) => s.href);

  return (
    <footer className="relative mt-auto bg-paper text-ink">
      <InkDivider className="absolute -top-[38px] h-10 w-full rotate-180" />
      <div className="paper-grain">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-display text-3xl font-bold">
              Lunetta<span className="text-ember">.</span>
            </p>
            <p className="mt-3 max-w-sm text-ink/75">{siteConfig.tagline} A hand-drawn world, minted on {chainConfig.chain.name}.</p>
            <ul className="mt-6 flex gap-3">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-lantern shadow-[3px_3px_0_0_#12142B] transition-transform hover:-translate-y-0.5"
                  >
                    {s.icon}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <nav aria-label="Footer">
            <p className="font-display text-lg font-semibold">Explore</p>
            <ul className="mt-3 space-y-2 text-ink/80">
              <li><Link className="hover:underline" href="/#world">The world</Link></li>
              <li><Link className="hover:underline" href="/mint">Mint</Link></li>
              <li><Link className="hover:underline" href="/gallery">Your gallery</Link></li>
            </ul>
          </nav>
          <div>
            <p className="font-display text-lg font-semibold">Contract</p>
            {chainConfig.isContractConfigured ? (
              <a
                href={explorerAddress(chainConfig.contractAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block break-all font-mono text-sm text-ink/80 hover:underline"
              >
                {chainConfig.contractAddress}
              </a>
            ) : (
              <p className="mt-3 text-sm text-ink/70">Announced at launch. Only trust the address shown on this site.</p>
            )}
          </div>
        </div>
        <div className="border-t-2 border-ink/15">
          <p className="mx-auto max-w-6xl px-5 py-5 text-sm text-ink/60">
            © {new Date().getFullYear()} Lunetta. All art and characters are original works. Never share your seed phrase — we will never ask for it.
          </p>
        </div>
      </div>
    </footer>
  );
}
