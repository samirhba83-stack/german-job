import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

/** Every answer here states a real, implemented policy (cancellation-at-period-end, the 7-day
 * admin-reviewed refund window, Paddle as Merchant of Record) — none of it is aspirational or
 * invented; each matches the actual backend behavior (`CancellationService`, `RefundService`,
 * `PaddlePaymentAdapter`). */
const FAQS: { question: string; answer: string }[] = [
  {
    question: 'Is the Free plan really free?',
    answer:
      'Yes — permanently, with no payment method required. It lets you build your profile, check CV readiness, and preview how campaigns work before you pay for anything.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. Cancellation is always effective at the end of your current billing period — you keep full access until then, never cut off mid-cycle.',
  },
  {
    question: 'What if I need a refund?',
    answer:
      'Refunds are available within 7 days of your first successful payment. Every request is reviewed by our team with a reason recorded, and the outcome is logged to a permanent audit trail.',
  },
  {
    question: 'Can I switch plans later?',
    answer:
      'Yes — upgrade or downgrade anytime from your Billing Workspace. Paddle calculates the prorated difference automatically.',
  },
  {
    question: 'How is my payment secured?',
    answer:
      'Paddle is our Merchant of Record and handles your card details directly on their secure, PCI-compliant checkout page — your payment information never touches German Job Engine\'s servers.',
  },
  {
    question: 'What happens if a payment fails?',
    answer:
      "You'll get a grace period and an email notification to update your payment method before any access is paused — we never cancel a subscription on the first failed charge.",
  },
];

export function FaqSection() {
  return (
    <section className="mx-auto max-w-content px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-heading-lg font-semibold text-primary md:text-display">Frequently asked questions</h2>
      </div>
      <div className="mx-auto mt-8 max-w-2xl">
        <Accordion type="single">
          {FAQS.map((faq) => (
            <AccordionItem key={faq.question} value={faq.question}>
              <AccordionTrigger className="text-body font-medium">{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
