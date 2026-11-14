# VIT PULSE V9.1 setup

V9.1 is a campus **explore + chat** app built on the V7 personality engine (the dating features have been removed):

- **Profile**: name, program/year, photo (Google photo or colour avatar), short bio, a "what I'm up to" status, interests, and what you are open to (study buddy, food runs, sports, project team…), then the 36-question vibe quiz.
- **Explore**: a live radar of people around you (500 m / 1 km / 3 km) plus a list sorted by distance, with filters for "active now" and "open to". Tap someone to see their status, vibe %, shared interests, and say hi.
- **Places**: hangout spots near you. Add the spot you're at, check in when you're within ~250 m (you're checked out automatically when you walk away), see who's there now, and talk in each spot's public room.
- **Chats**: message anyone directly, with icebreakers picked from what you have in common.
- **Settings**: share location on/off, show me on Explore on/off, sample previews, sign out.

### Location & privacy
Location is read only while the app is open and only after you turn it on. It is rounded to 3 decimals (about 110 m) **before** it is saved, and other people only ever see a rough label such as "~5 min walk". No precise coordinates are stored.

## Firebase

1. Enable Authentication → Google and add your deployment domain under Authentication → Settings → Authorized domains.
2. Create a Firestore database and **deploy the updated `firestore.rules`**. V9.1 needs the new `publicProfiles`, `chats` and `places` rules.
3. Firebase may ask for a composite index the first time Explore, Places or chat runs. If it does, follow the link in the browser console error.

## Data model

| Path | Contents | Who can read |
| --- | --- | --- |
| `users/{uid}` (+ `results`) | private profile and quiz results | owner only |
| `publicProfiles/{uid}` | card data, vibe vector, coarse location, current place | any signed-in user |
| `chats/{a}_{b}` + `messages` | direct conversations | the two members |
| `places/{id}` + `messages` | hangout spots and their public rooms | any signed-in user |

## Sample people and spots

When no other students are online, Explore and Places show 10 fictional people and 4 spots labelled **SAMPLE**, placed around your location, so the full flow can be demoed. They live only in the browser (localStorage) and are never written to Firestore. You can turn them off in Settings.
