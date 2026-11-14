'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { ALLOWED_DOMAIN, GRIEVANCE, OPERATOR, POLICY_UPDATED } from '@/lib/config'

const grievanceLine = GRIEVANCE.email
  ? <>Grievance Officer: <b>{GRIEVANCE.name || 'Grievance Officer'}</b>, <b>{GRIEVANCE.email}</b>.</>
  : <>Contact the Grievance Officer through <b>Settings → Report a problem</b> in the app.</>

export function Legal({ onClose, initial = 'terms' }: { onClose: () => void; initial?: 'terms' | 'privacy' }) {
  const [tab, setTab] = useState(initial)
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet legal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Terms and Privacy Policy">
        <button className="close-detail" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="segmented small legal-tabs">
          <button className={tab === 'terms' ? 'on' : ''} onClick={() => setTab('terms')}>Terms of Use</button>
          <button className={tab === 'privacy' ? 'on' : ''} onClick={() => setTab('privacy')}>Privacy Policy</button>
        </div>
        <small className="muted">Last updated {POLICY_UPDATED}</small>
        {tab === 'terms' ? <Terms /> : <Privacy />}
        <button className="primary-button wide" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

function Terms() {
  return <>
    <h3>Terms of Use</h3>
    <p>VIT Pulse is operated by {OPERATOR}. It is an independent student project and is <b>not an official service of Vellore Institute of Technology (VIT)</b>. By creating an account you agree to these Terms and to our Privacy Policy.</p>

    <h4>1. Eligibility</h4>
    <ul>
      <li>You must be at least 18 years old and a current VIT student with a valid @{ALLOWED_DOMAIN} account.</li>
      <li>One account per person. Your profile must be about you and accurate.</li>
    </ul>

    <h4>2. Your conduct</h4>
    <p>You must follow the laws of India, VIT&apos;s Student Code of Conduct and university policies, including the UGC Regulations on Curbing the Menace of Ragging in Higher Educational Institutions, 2009. In line with Rule 3(1)(b) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, you must not post or send anything that:</p>
    <ul>
      <li>belongs to someone else, or that you have no right to share;</li>
      <li>is obscene, pornographic, paedophilic, invasive of another person&apos;s privacy (including their body), insulting or harassing on the basis of gender, or racially, ethnically or caste-wise objectionable;</li>
      <li>harasses, stalks, threatens, bullies or defames anyone, or amounts to ragging;</li>
      <li>impersonates another person or misleads about who you are;</li>
      <li>is harmful to children, promotes violence, or threatens the unity, integrity, defence, security or sovereignty of India or public order;</li>
      <li>contains malware, spam, advertising or solicitation, or is false information shared to cause harm;</li>
      <li>violates any law in force.</li>
    </ul>
    <p>Such acts may also be offences under the Information Technology Act, 2000 (e.g. sections 66C, 66D, 66E, 67, 67A) and the Bharatiya Nyaya Sanhita, 2023 (e.g. sexual harassment, stalking, criminal intimidation and defamation).</p>

    <h4>3. Consent and safety</h4>
    <ul>
      <li>A like, follow request or match is not consent to anything. Respect &ldquo;no&rdquo;, unfollows and unmatches.</li>
      <li>Never share someone else&apos;s photos, messages or personal details without their permission.</li>
      <li>Meet in public places on campus and tell a friend. Use <b>Report</b> on any profile or in Settings if something is wrong.</li>
    </ul>

    <h4>4. Your content</h4>
    <ul>
      <li>You own what you post. You give us a limited licence to store and display it to the people you allow, only to run the app.</li>
      <li>Posts and your follower/following lists are visible only to you and people whose follow request you accepted.</li>
    </ul>

    <h4>5. Enforcement</h4>
    <ul>
      <li>We may remove content or suspend accounts that break these Terms or the law. Where required by law or by a valid order, we may preserve information and share it with authorities. Serious violations involving students (such as ragging or harassment) may be reported to the appropriate VIT authority or Anti-Ragging Committee.</li>
      <li>Content that shows a person in a sexual act, full or partial nudity, or is a morphed image of them will be removed within 24 hours of a complaint, as required by Rule 3(2)(b) of the IT Rules, 2021.</li>
    </ul>

    <h4>6. Grievances</h4>
    <p>{grievanceLine} Complaints are acknowledged within 24 hours and resolved within 15 days, as required by Rule 3(2) of the IT Rules, 2021.</p>

    <h4>7. Disclaimers and law</h4>
    <ul>
      <li>Match scores and personality types are estimates for fun and guidance, not professional advice. The app is provided &ldquo;as is&rdquo; to the extent permitted by law.</li>
      <li>Profiles marked SAMPLE are fictional demonstrations.</li>
      <li>These Terms are governed by the laws of India. Courts at Vellore, Tamil Nadu have jurisdiction, subject to any consumer-protection rights you have.</li>
      <li>You can stop using the app and delete your account at any time in Settings.</li>
    </ul>
  </>
}

function Privacy() {
  return <>
    <h3>Privacy Policy</h3>
    <p>Privacy is a fundamental right under Article 21 of the Constitution of India (Justice K.S. Puttaswamy v. Union of India, 2017). This notice explains how {OPERATOR} (the &ldquo;Data Fiduciary&rdquo;) handles your personal data under the Digital Personal Data Protection Act, 2023 (&ldquo;DPDP Act&rdquo;) and the Information Technology Act, 2000 and rules made under it.</p>

    <h4>1. Data we collect</h4>
    <ul>
      <li><b>Account:</b> your name, @{ALLOWED_DOMAIN} email address and Google account ID (from Google Sign-In).</li>
      <li><b>Profile:</b> username, photo, age, gender, who you want to see, intent, program, year, bio, status, interests, prompts and the posts you create.</li>
      <li><b>Personality quiz:</b> your answers are turned into trait scores and a personality type.</li>
      <li><b>Activity:</b> likes, passes, follow requests, matches, post likes, messages and reports.</li>
      <li><b>Location (optional, only if you turn it on):</b> processed on your device to learn lifestyle patterns such as &ldquo;night owl&rdquo;. Only these patterns and a rough area code (about 1 km) are stored. Your exact location is never stored or shown.</li>
    </ul>

    <h4>2. Why we use it (purpose)</h4>
    <ul>
      <li>To create your account and check that you are a VIT student.</li>
      <li>To show you profiles and rank them by how well you may get along, including learning from your own likes and passes.</li>
      <li>To let you follow, chat and share posts with people you choose.</li>
      <li>To keep the community safe, handle reports and meet legal obligations.</li>
    </ul>
    <p>We do not sell your data and do not use it for advertising.</p>

    <h4>3. Consent</h4>
    <p>We process your data on the basis of the consent you give when you sign up (section 6, DPDP Act). Location is a separate, optional consent. You can withdraw consent at any time by turning off location or deleting your account; this does not affect processing done before withdrawal.</p>

    <h4>4. Who can see what</h4>
    <ul>
      <li><b>Other signed-in VIT students:</b> your card (name, username, photo, age, program, year, bio, status, interests, prompts, personality type).</li>
      <li><b>Only you and accepted followers:</b> your posts. Only you can see your follower and following lists.</li>
      <li><b>Only the two people in a chat:</b> its messages.</li>
      <li><b>Never shown to others:</b> your email, quiz answers and location.</li>
      <li><b>Service provider:</b> data is stored with Google Firebase (Google LLC), which may store it on servers outside India, as permitted under section 16 of the DPDP Act.</li>
      <li><b>Authorities:</b> only when required by law or a valid order.</li>
    </ul>

    <h4>5. Retention</h4>
    <p>We keep your data while your account is active. When you delete your account, your profile, username, posts, quiz results, follows and preferences are deleted. Messages you sent remain visible to the other person in that chat. Where the IT Rules, 2021 require it, we may keep information about deleted accounts or removed content for up to 180 days for investigation.</p>

    <h4>6. Your rights (DPDP Act, sections 11–14)</h4>
    <ul>
      <li><b>Access:</b> see your data in the app (profile, posts, matches, chats).</li>
      <li><b>Correction:</b> edit your profile or retake the quiz at any time.</li>
      <li><b>Erasure:</b> Settings → Delete account.</li>
      <li><b>Grievance redressal:</b> {grievanceLine}</li>
      <li><b>Nomination:</b> you may nominate a person to exercise your rights in case of death or incapacity by writing to the Grievance Officer.</li>
      <li>If you are not satisfied, you may complain to the Data Protection Board of India.</li>
    </ul>

    <h4>7. Security</h4>
    <p>Data is protected by Google Sign-In, encrypted connections and access rules that stop people from reading what they are not allowed to see. No system is perfectly secure; if a personal data breach occurs we will inform you and the Data Protection Board as required by law.</p>

    <h4>8. Children</h4>
    <p>The app is only for people aged 18 and over. We do not knowingly process the data of anyone under 18.</p>

    <h4>9. Changes</h4>
    <p>If we change this policy we will update the date above and, for important changes, ask for your consent again.</p>
  </>
}
