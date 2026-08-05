import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** The first fully public, unauthenticated page in the product (M27.5) — its own minimal header,
 * not `GlobalHeader` (which assumes an authenticated session: search, notifications, profile
 * menu). Just identity + the two real entry points into the app. */
export function MarketingHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-content items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-heading-md font-semibold text-primary">
          German Job Engine
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="rounded-md px-3 py-2 text-body-sm font-medium text-secondary hover:bg-background-subtle hover:text-primary">
            Log in
          </Link>
          <Link href="/register">
            <Button size="sm">Get started</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
