/** App-wide settings. Fill in GRIEVANCE before going live (required by the IT Rules, 2021). */
export const ALLOWED_DOMAIN = 'vitstudent.ac.in'
export const isAllowedEmail = (email?: string | null) => !!email && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)

export const OPERATOR = 'VIT Pulse (a student-run project)'
export const GRIEVANCE = {
  name: '',  // e.g. 'A. Student'
  email: '', // e.g. 'grievance.vitpulse@vitstudent.ac.in'
}
export const POLICY_UPDATED = '14 November 2026'
