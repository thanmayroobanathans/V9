# VIT PULSE V9.6

A swipe-to-match app for VIT students. Swipe right to like and left to pass. When two people like each other they match and can chat one-to-one.

## Features

- **VIT accounts only:** sign-in is limited to `@vitstudent.ac.in` Google accounts. This is checked in the app and enforced in `firestore.rules` (verified email with that domain).
- **Username:** everyone picks a unique `@username` (3–20 characters: a–z, 0–9, `.`, `_`). Availability is checked live, and handles are claimed in a transaction (`usernames/{handle}`).
- **Profile photo:** upload your own. It is cropped and compressed on the phone (~256 px) and stored with the profile, so no Firebase Storage or paid plan is needed.
- **Follow requests:** search by username, then send a follow request. Once it's accepted, a chat opens between you.
- **Private profiles and posts:** posts (text and/or photo) and their likes are visible only to you and to people whose follow request you accepted. Follower and following lists are visible only to you.
- **Report, delete, legal:** you can report a profile or a problem, delete your account, and read the Terms of Use and Privacy Policy, which is written to the DPDP Act 2023, the IT Act 2000 and IT Rules 2021, and VIT conduct rules.

- **Profile:** name, age (18+), program and year, who you are and who you want to see, what you're looking for, photo, bio, status, interests, "open to", and two prompts.
- **Personality quiz:** 36 questions in a clean one-question-per-screen layout. People see a simple type (e.g. "The Spark ✨") and four sliders.
- **Swipe:** a card deck ranked by match %, with plain-English reasons ("You're both night owls", "Into Coding, Music"). You can filter by age and by what people are looking for.
- **Matches & chat:** a match is only created when both people liked each other (enforced in `firestore.rules`). Chats are live, with icebreakers, unread badges, a pop-up for new messages in any conversation, offline sending, and "load earlier" paging.
- **Lifestyle matching (optional):** location is used in the background to learn your daily rhythm. It is never shown to anyone, and no coordinates are stored.

## How matching works (background)

1. **Turing machine → Kalman filter.** The 36 answers are read by a full-covariance Kalman filter (`lib/trait-kalman.ts`). Your 11 traits are the hidden state. Each answer is a noisy measurement of where you lean compared with the options you *didn't* pick. The full 11×11 covariance lets traits that move together (openness, novelty, intellect…) share evidence instead of being counted twice. The filter also reports how certain it is.
2. **Original algorithm, unchanged.** `compatibility()` in `lib/pulse-model.ts` (variance-weighted distance plus cosine similarity) still compares two people. It now runs on the Kalman traits, and the result is mapped onto a stable display scale.
3. **Lifestyle from GPS (optional).** A separate 2-D Kalman filter smooths GPS on the phone (`lib/kalman.ts`). Lifestyle features derived from it (`lib/nature.ts`) slightly refine the traits. Location is never shown and no coordinates are stored.
4. **Bounded context (at most ±12 points):** daily rhythm, same ~1 km area, shared interests, the same intent, and a background Jung-style fit.
5. **Taste learner (grows with use).** A second Kalman filter (`lib/learner.ts`) learns what each person actually likes from their own swipes (like +1, super +1.3, pass −1) and from matches that turn into conversations (+1.5). Its influence scales with its confidence, so new users are unaffected and it matters more over time. In simulation, ranking accuracy (AUC) on unseen people went 0.55 → 0.61 after 10 swipes → 0.63 after 30 → 0.65 after 60. The state is saved privately at `users/{uid}/preferences/matcher`.

### Benchmark (simulated test takers with known traits, 150 people)

| | old additive scorer | Kalman engine |
|---|---|---|
| Trait recovery (correlation with true traits) | 0.34 | **0.54** |
| Match-ranking agreement with true compatibility (Spearman ρ) | 0.29 | **0.36** |
| True best match appears in their top 10 | 25 % | **31 %** |

These are simulations built on the quiz's own answer model, not data from real students.

## Chat at scale

Every conversation is its own document (`matches/{a}_{b}`), and every message is its own document in `messages`. With 100 people online all messaging each other, each pair writes to a different place, so nothing contends.

Each person has a single listener on all their matches. The match document carries `lastMessage`, `lastSender` and `lastAt`. So if A and B both message C at the same moment, C's listener fires for both conversations, both show as unread, and C gets a pop-up. Firestore's offline cache queues messages sent without signal.

## Terms and grievance officer

At login, people must tick "I'm 18+, a VIT student, and agree to the Terms of Use and Privacy Policy". Both documents are also in Settings.

**Before launch, fill in `GRIEVANCE` (name and email) in `lib/config.ts`.** The IT Rules, 2021 require a named grievance officer. Have the text reviewed by someone qualified in Indian law, and check it against VIT's current student code of conduct.

## Firebase setup

1. In Authentication, enable Google sign-in and add your domain (e.g. `thanmayroobanathans.github.io`) under Settings → Authorized domains.
2. In Firestore, publish the contents of `firestore.rules`. This is required: V9.3 changed the rules.
3. No composite indexes are needed.

## Data model

| Path | Contents | Who can read |
| --- | --- | --- |
| `users/{uid}` (+ `results`) | private profile and quiz results | owner only |
| `publicProfiles/{uid}` | card data, traits, lifestyle features, area code (no coordinates, no email) | signed-in users |
| `connections/{from}_{to}` | like / super / pass | sender and recipient |
| `matches/{a}_{b}` + `messages` | chat (after a mutual like or an accepted follow) | the two members |
| `usernames/{handle}` | `{ uid }` — keeps usernames unique | signed-in users |
| `follows/{from}_{to}` | follow request: pending / accepted | the two people involved |
| `users/{uid}/posts/{id}` + `likes` | posts and likes | owner and accepted followers |
| `reports/{id}` | reports | nobody via the app (review in the Firebase console) |

## Sample people

While no other students are on the app, the Swipe deck shows 10 fictional people labelled **SAMPLE**. They live only in the browser and are never written to Firestore. You can turn them off in Settings.
