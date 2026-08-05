import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function FinalCtaSection() {
  return (
    <section className="mx-auto max-w-content px-4 py-16 text-center sm:px-6 sm:py-20">
      <h2 className="text-heading-lg font-semibold text-primary md:text-display">Ready to apply smarter?</h2>
      <p className="mx-auto mt-3 max-w-md text-body text-secondary">
        Start on the Free plan today — no credit card required. Upgrade whenever you&apos;re ready.
      </p>
      <div className="mt-6">
        <Link href="/register">
          <Button size="lg">Create your free account</Button>
        </Link>
      </div>
    </section>
  );
}
