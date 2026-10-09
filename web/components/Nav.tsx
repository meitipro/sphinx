import Link from 'next/link';

import { WalletButton } from './Wallet';

/** The site's mark, the same drawing as app/icon.svg without its ground: an orchid seal with a keyhole. */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="106 106 300 300" aria-hidden style={{ flexShrink: 0 }}>
      <rect x="106" y="106" width="300" height="300" rx="46" fill="#17171e" stroke="#34343f" strokeWidth="8" />
      <circle cx="256" cy="256" r="92" fill="#f0abfc" />
      <circle cx="256" cy="234" r="24" fill="#2a0a2e" />
      <path d="M244 248 L268 248 L276 300 L236 300 Z" fill="#2a0a2e" />
    </svg>
  );
}

export function Nav() {
  return (
    <header className="c-nav">
      <div className="c-wrap c-nav-row">
        <Link href="/" className="c-brand" aria-label="Sphinx home">
          <Mark />
          <span className="c-word">Sphinx</span>
        </Link>
        <nav className="c-links" aria-label="Main">
          <Link href="/riddles">Riddles</Link>
          <Link href="/riddles#hosts">Hosts</Link>
          <Link href="/riddles#results">Results</Link>
          <Link href="/docs">Docs</Link>
        </nav>
        <div className="c-nav-right">
          <span className="c-pill hidden sm:inline-flex" title="GenLayer Studio Next, chain 61997">
            <span className="dot" />
            Studio Next
          </span>
          <WalletButton />
          <Link href="/new" className="c-btn small solid hidden sm:inline-flex">
            Host a riddle
          </Link>
        </div>
      </div>
    </header>
  );
}
