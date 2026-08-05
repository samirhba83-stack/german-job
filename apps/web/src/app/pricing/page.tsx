import type { Metadata } from 'next';
import { PricingPageContent } from '@/features/billing/components/marketing/pricing-page-content';

export const metadata: Metadata = {
  title: 'Pricing — German Job Engine',
  description: 'Plans for every stage of your job search — from a free profile-prep tier to full AI-personalized execution.',
};

export default function PricingPage() {
  return <PricingPageContent />;
}
