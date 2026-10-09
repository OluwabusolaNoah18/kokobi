/*
 * Paystack's local card/transfer fee: 1.5% + NGN 100 (the NGN 100 is waived under NGN 2,500), capped at NGN 2,000.
 * When PASS_PAYSTACK_FEE is not "false", the customer pays enough extra that you receive the full item total.
 * Keep the same numbers in client/src/data.js so the website shows the same amount Paystack will charge.
 */
export const passFee = () => process.env.PASS_PAYSTACK_FEE !== 'false';

export const paystackFee = (amount) => Math.min(2000, Math.ceil(amount * 0.015 + (amount >= 2500 ? 100 : 0)));

/** total = item total in naira. Returns { total, fee, charge } where charge is what the customer pays online. */
export function chargeFor(total, pass = passFee()) {
  if (!pass) return { total, fee: 0, charge: total };
  let a = total;
  for (let i = 0; i < 10; i++) a = total + paystackFee(a);
  while (a - paystackFee(a) < total) a++;
  return { total, fee: a - total, charge: a };
}
