import { Lock, ShieldCheck, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';

const POINTS = [
  {
    icon: Lock,
    title: 'Paddle-secured checkout',
    body: 'Paddle is our Merchant of Record and processes every payment on their own PCI-compliant infrastructure — your card details are never seen or stored by German Job Engine.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified, tamper-proof billing events',
    body: 'Every subscription change is confirmed by a cryptographically signed webhook before your plan changes — never a client-side redirect alone.',
  },
  {
    icon: RefreshCw,
    title: 'Cancel or change plans anytime',
    body: 'No lock-in contracts. Cancellation takes effect at the end of your paid period, and plan changes apply immediately with automatic prorated billing.',
  },
];

export function TrustSecuritySection() {
  return (
    <section className="border-y border-border bg-background-subtle">
      <div className="mx-auto max-w-content px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-heading-lg font-semibold text-primary md:text-display">Secure by design</h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {POINTS.map((point) => (
            <Card key={point.title} padding="lg" className="space-y-3">
              <point.icon className="h-6 w-6 text-accent" aria-hidden="true" strokeWidth={1.75} />
              <h3 className="text-body font-semibold text-primary">{point.title}</h3>
              <p className="text-body-sm text-secondary">{point.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
