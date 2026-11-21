/** App-wide settings. Fill in GRIEVANCE before going live (required by the IT Rules, 2021). */
export const APP_NAME = 'Pulse'

/** Anyone with a verified Google account can sign in (18+ is confirmed at sign-up). */
export const isAllowedEmail = (email?: string | null) => !!email && email.includes('@')
/**
 * The signed-in email. With some Firebase account-linking settings Google sign-in leaves
 * `user.email` empty and only puts the address in providerData — so check both.
 */
export const emailOf = (u: { email: string | null; providerData?: { email: string | null }[] } | null) =>
  u?.email || u?.providerData?.find(p => p.email)?.email || null

export const OPERATOR = 'Pulse (an independent project)'
export const GRIEVANCE = {
  name: '',  // e.g. 'A. Person'
  email: '', // e.g. 'grievance@yourdomain.com'
}
export const POLICY_UPDATED = '21 November 2026'
