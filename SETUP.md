# VIT PULSE V9.3

A swipe-to-match app for VIT students. Swipe right to like and left to pass. When two people like each other they match and can chat one-to-one.

## Features

- **Profile:** name, age (18+), program and year, who you are and who you want to see, what you're looking for, photo, bio, status, interests, "open to", and two prompts.
- **Personality quiz:** quick (12 questions) or full (36). People see a simple personality type (e.g. "The Spark ✨") with four plain-language sliders. The maths stays in the background.
- **Swipe:** a card deck ranked by match %, with plain-English reasons ("You're both night owls", "Into Coding, Music"). You can filter by age and by what people are looking for.
- **Matches & chat:** a match is only created when both people liked each other (enforced in `firestore.rules`). Chats are live, with icebreakers, unread badges, a pop-up for new messages in any conversation, offline sending, and "load earlier" paging.
- **Lifestyle matching (optional):** location is used in the background to learn your daily rhythm. It is never shown to anyone, and no coordinates are stored.

## How matching works (background)

1. **Original algorithm, unchanged.** `compatibility()` in `lib/pulse-model.ts` (variance-weighted distance plus cosine similarity over 11 traits) is still the core of every score.
2. **Better input from behaviour.** GPS is smoothed on the phone by a 2-D constant-velocity **Kalman filter** (`lib/kalman.ts`). In simulation it cut error from 25 m to 5 m while sitting still and from 26 m to 18 m while walking, and dropped wild fixes. The smoothed track never leaves the phone. From it, `lib/nature.ts` derives lifestyle features: roaming range, variety, routine, activity, night-owl and early-bird. These nudge each person's 11 traits slightly (at most ±0.12, scaled by confidence) before the original algorithm runs.
3. **Bounded context adjustment (at most ±12 points):** similar daily rhythm, usually in the same ~1 km area, shared interests, the same intent, and a background Jung-style personality fit (`lib/jung.ts`).

Only the derived features and a ~1.2 km area code are saved, and neither is ever displayed.

## Chat at scale

Every conversation is its own document (`matches/{a}_{b}`), and every message is its own document in `messages`. With 100 people online all messaging each other, each pair writes to a different place, so nothing contends.

Each person has a single listener on all their matches. The match document carries `lastMessage`, `lastSender` and `lastAt`. So if A and B both message C at the same moment, C's listener fires for both conversations, both show as unread, and C gets a pop-up. Firestore's offline cache queues messages sent without signal.

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
| `matches/{a}_{b}` + `messages` | match and its chat | the two members |

## Sample people

While no other students are on the app, the Swipe deck shows 10 fictional people labelled **SAMPLE**. They live only in the browser and are never written to Firestore. You can turn them off in Settings.
