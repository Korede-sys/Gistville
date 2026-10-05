/**
 * A vendor's verified badge stays live until `verified_until` passes, even
 * after the Paystack subscription itself has been cancelled/disabled. This
 * is the cancellation grace period: `subscription.disable` (see
 * api/paystack/webhook.ts) no longer flips `profiles.verified` to false
 * immediately — it only marks the subscription row inactive. The badge then
 * naturally expires on its own at the end of the already-paid period
 * instead of being revoked the instant Paystack sends the webhook.
 */
export function isEffectivelyVerified(
  verified: boolean | null | undefined,
  verifiedUntil: string | null | undefined
): boolean {
  if (!verified) return false;
  if (!verifiedUntil) return true;
  return new Date(verifiedUntil).getTime() > Date.now();
}
