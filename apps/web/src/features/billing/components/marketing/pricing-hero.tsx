import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** The pricing page's hero — deliberately no product screenshot/illustration (none exists to show
 * honestly yet) and no gradient background per this milestone's own design principles ("no
 * excessive gradients"). Typography and real trust microcopy carry it instead. */
export function PricingHero() {
  return (
    <section className="mx-auto max-w-content px-4 py-16 text-center sm:px-6 sm:py-24">
      <h1 className="mx-auto max-w-2xl text-display font-semibold text-primary md:text-display-md" style={{ textWrap: 'balance' }}>
        Plans built for every stage of your job search
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-body text-secondary">
        Start free to prepare your profile. Upgrade when you&apos;re ready for AI-personalized applications,
        strategic sending, and full execution tracking.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href="/register">
          <Button size="lg">Start free</Button>
        </Link>
        <Link href="#plans">
          <Button size="lg" variant="secondary">
            See plans
          </Button>
        </Link>
      </div>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-caption text-secondary">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />
        No credit card required for the Free plan · Secure checkout by Paddle
      </p>
    </section>
  );
}
