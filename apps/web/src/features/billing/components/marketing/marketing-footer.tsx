import Link from 'next/link';

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-content flex-col items-center gap-3 px-4 py-8 text-center sm:px-6">
        <p className="text-body-sm font-semibold text-primary">German Job Engine</p>
        <p className="max-w-md text-caption text-secondary">
          AI-personalized job applications for the German market. Payments processed securely by Paddle.
        </p>
        <div className="flex gap-4 text-caption text-secondary">
          <Link href="/login" className="hover:text-primary hover:underline">
            Log in
          </Link>
          <Link href="/register" className="hover:text-primary hover:underline">
            Create account
          </Link>
        </div>
      </div>
    </footer>
  );
}
