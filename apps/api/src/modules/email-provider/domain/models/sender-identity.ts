/** A provider-independent sender identity — how "from" is expressed regardless of which
 * provider ultimately sends the message. `replyToEmailAddress` is M28.5's "Safe Sender Strategy"
 * (Phase 11): the platform's own verified domain is always the From address; a real candidate's
 * own validated email address is carried here instead, so a recipient's reply reaches the
 * candidate directly without this application ever sending FROM an unverified, arbitrary user
 * address (a real spoofing/deliverability risk this design avoids by construction). */
export interface SenderIdentity {
  readonly displayName: string;
  readonly emailAddress: string;
  readonly replyToEmailAddress?: string | null;
}
