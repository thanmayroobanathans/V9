/** App-wide settings. Fill in GRIEVANCE before going live (required by the IT Rules, 2021). */
/** VIT student email domains: Vellore & Chennai, AP, Bhopal. Keep in sync with firestore.rules. */
export const ALLOWED_DOMAINS = ['vitstudent.ac.in', 'vitapstudent.ac.in', 'vitbhopal.ac.in']
export const ALLOWED_DOMAIN = ALLOWED_DOMAINS[0]
export const isAllowedEmail = (email?: string | null) => {
  const e = (email ?? '').trim().toLowerCase()
  return ALLOWED_DOMAINS.some(d => e.endsWith(`@${d}`))
}
/**
 * The signed-in email. Depending on the Firebase "account linking" setting, Google sign-in can
 * leave `user.email` empty and only put the address in providerData — check both.
 */
export const emailOf = (u: { email: string | null; providerData?: { email: string | null }[] } | null) =>
  u?.email || u?.providerData?.find(p => p.email)?.email || null

export const OPERATOR = 'VIT Pulse (a student-run project)'
export const GRIEVANCE = {
  name: '',  // e.g. 'A. Student'
  email: '', // e.g. 'grievance.vitpulse@vitstudent.ac.in'
}
export const POLICY_UPDATED = '14 November 2026'
