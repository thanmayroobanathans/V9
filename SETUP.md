# VIT PULSE V9 setup

V9 turns the V7 personality engine into a dating-app prototype:

- **Onboarding**: first name, age (18+), program/year, gender, who you want to see, what you're looking for, photo (Google photo or colour portrait), bio, 3–6 interests, two Hinge-style prompts, then the 36-question personality calibration.
- **Discover**: a swipeable card deck (drag or use the buttons; swipe right to like, left to pass, up to super-like). Each card shows a compatibility ring, shared traits and a "why Pulse paired you" panel. Filters for age range and intent.
- **Matches**: a match is only created when both people like each other, and an "It's a match" screen appears. Includes a list of new matches and conversations, and a live Firestore chat with icebreakers suggested from shared traits. Either person can unmatch.
- **Profile**: preview your card as others see it, edit your profile, and retake the quiz.
- **Settings**: pause discovery, hide your campus signal, sample-profile preview mode, sign out.

## Firebase

1. Enable Authentication → Google and add your deployment domain under Authentication → Settings → Authorized domains.
2. Create a Firestore database and **deploy the updated `firestore.rules`**. V9 needs the new `publicProfiles`, `connections`, `matches` and `messages` rules.
3. Firebase may ask for a composite index the first time Discover or chat runs. If it does, follow the link in the browser console error.

## Data model

| Path | Contents | Who can read |
| --- | --- | --- |
| `users/{uid}` (+ `results`, `location`) | private profile, quiz results, precise GPS | owner only |
| `publicProfiles/{uid}` | card data + personality vector, coarse campus signal. No email, no coordinates | any signed-in user |
| `connections/{from}_{to}` | like / super / pass | sender and recipient |
| `matches/{a}_{b}` | members, last message, status | the two members; creation is checked against both likes in the rules |
| `matches/{id}/messages` | chat messages | the two members |

## Sample profiles

When no other students exist yet, Discover shows 10 fictional profiles labelled **SAMPLE** so the full flow (swipe → match → chat) can be demoed. They live only in the browser (localStorage) and are never written to Firestore. You can turn them off in Settings.
