/** App-wide settings. Fill in GRIEVANCE before going live (required by the IT Rules, 2021). */
export const ALLOWED_DOMAIN = 'vitstudent.ac.in'
export const isAllowedEmail = (email?: string | null) => !!email && email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)
/**
 * The signed-in email. With some Firebase account-linking settings Google sign-in leaves
 * `user.email` empty and only puts the address in providerData — so check both.
 */
export const emailOf = (u: { email: string | null; providerData?: { email: string | null }[] } | null) =>
  u?.email || u?.providerData?.find(p => p.email)?.email || null

export const OPERATOR = 'VIT Pulse (a student-run project)'
export const GRIEVANCE = {
  name: '',  // e.g. 'A. Student'
  email: '', // e.g. 'grievance.vitpulse@vitstudent.ac.in'
}
export const POLICY_UPDATED = '14 November 2026'
