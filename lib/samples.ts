import type { Coarse, Person, Place } from './social'
import { QUESTIONS, classify, scoreAnswers } from './pulse-model'

/**
 * Preview content. Fictional, clearly labelled SAMPLE people and places that live only in the
 * browser — never written to Firestore. They are positioned around the viewer so the radar and
 * place features can be tried before other students join. Toggle off in Settings.
 */
export const DEFAULT_ANCHOR: Coarse = { lat: 12.9692, lng: 79.1559 } // VIT Vellore, used when location is off

const seed = (n: number) => () => { n = (n * 9301 + 49297) % 233280; return n / 233280 }
const offset = (a: Coarse, north: number, east: number): Coarse => ({
  lat: Math.round((a.lat + north / 111320) * 1000) / 1000,
  lng: Math.round((a.lng + east / (111320 * Math.cos(a.lat * Math.PI / 180))) * 1000) / 1000,
})

type Raw = Pick<Person, 'name' | 'program' | 'year' | 'bio' | 'status' | 'interests' | 'openTo' | 'hue'> & { n: number; e: number; mins: number; place?: number }
const RAW: Raw[] = [
  { name: 'Ananya', program: 'CSE', year: '3rd year', bio: 'Debugging code by day, debugging my sleep schedule by night.', status: 'Grinding DSA, need a study buddy', interests: ['Coding', 'Music', 'Chai'], openTo: ['Study buddy', 'Just chatting'], hue: 340, n: 120, e: 60, mins: 3, place: 0 },
  { name: 'Rohan', program: 'ECE', year: '4th year', bio: 'Robotics club, badminton at 6 AM, unreasonable love for filter coffee.', status: 'Anyone up for badminton at 6?', interests: ['Robotics', 'Badminton', 'Coffee'], openTo: ['Sports', 'Project team'], hue: 210, n: -300, e: 250, mins: 8, place: 2 },
  { name: 'Meera', program: 'BBA', year: '2nd year', bio: 'Riviera volunteer, part-time poet, full-time overthinker.', status: 'Planning a poetry open mic 🎤', interests: ['Poetry', 'Riviera', 'Dance'], openTo: ['Just chatting', 'Exploring campus'], hue: 280, n: 500, e: -350, mins: 15 },
  { name: 'Arjun', program: 'Mechanical', year: '4th year', bio: 'Gym, cricket, and planning trips I never take.', status: 'Foodys run in 10, who is in?', interests: ['Gym', 'Cricket', 'Travel'], openTo: ['Food runs', 'Sports'], hue: 25, n: -80, e: -140, mins: 1, place: 1 },
  { name: 'Ishita', program: 'Biotech', year: '3rd year', bio: 'Photographing every sunset on campus. Ask me for my top 3 spots.', status: 'Golden hour photo walk today', interests: ['Photography', 'Art', 'Travel'], openTo: ['Exploring campus', 'Just chatting'], hue: 15, n: 900, e: 600, mins: 25 },
  { name: 'Kabir', program: 'CSE (AI)', year: '2nd year', bio: 'Hackathon addict. 3 wins, 11 losses, 0 regrets.', status: 'Looking for 2 people for a hackathon', interests: ['Hackathons', 'Gaming', 'Anime'], openTo: ['Project team', 'Gaming'], hue: 160, n: 200, e: 180, mins: 5, place: 0 },
  { name: 'Sana', program: 'Architecture', year: '4th year', bio: 'I notice buildings before people. Working on it.', status: 'Sketching near the main building', interests: ['Art', 'Reading', 'Podcasts'], openTo: ['Just chatting'], hue: 45, n: -1400, e: 700, mins: 90 },
  { name: 'Dev', program: 'IT', year: '1st year', bio: 'New here. Guitarist on weekends. Show me around?', status: 'New to campus — show me around?', interests: ['Music', 'Football', 'Gaming'], openTo: ['Jam session', 'Exploring campus'], hue: 190, n: 60, e: -40, mins: 2, place: 1 },
  { name: 'Tara', program: 'Design', year: '3rd year', bio: 'Thrifting, sketching strangers (with permission), mild chaos.', status: 'Free for coffee after 4', interests: ['Fashion', 'Art', 'Movies'], openTo: ['Food runs', 'Just chatting'], hue: 300, n: -650, e: -500, mins: 40 },
  { name: 'Nikhil', program: 'EEE', year: '3rd year', bio: 'Debate captain. Will argue about anything, kindly.', status: 'Debate practice at 7, join us', interests: ['Debate', 'Reading', 'Chai'], openTo: ['Study buddy', 'Just chatting'], hue: 230, n: 350, e: 900, mins: 12 },
]
const PLACES = [{ name: 'Library study tables', emoji: '📚', n: 150, e: 100 }, { name: 'Food court', emoji: '🍜', n: -60, e: -120 }, { name: 'Badminton courts', emoji: '🏸', n: -320, e: 260 }, { name: 'Sunset steps', emoji: '🌅', n: 880, e: 580 }]

export function samplePlaces(anchor: Coarse): Place[] {
  return PLACES.map((p, i) => ({ id: `sample-place-${i}`, name: p.name, emoji: p.emoji, loc: offset(anchor, p.n, p.e), createdBy: 'sample', sample: true }))
}
export function samplePeople(anchor: Coarse): Person[] {
  const now = Date.now()
  return RAW.map((p, i) => {
    const r = seed(i * 7919 + 13)
    const vector = scoreAnswers(QUESTIONS.map(() => Math.floor(r() * 4))).map(v => Math.round(v * 100) / 100)
    const c = classify(vector).primary
    const { n, e, mins, place, ...rest } = p
    return { ...rest, uid: `sample-${i}`, vector, archetype: c.name, archetypeCode: c.code, photoURL: null, loc: offset(anchor, n, e), locAt: now - mins * 60000, placeId: place !== undefined ? `sample-place-${place}` : null, visible: true, sample: true }
  })
}

const REPLIES = ['Hey! 👋 Nice to meet you', 'Haha yes, I am around for a bit', 'Sure, what time works for you?', 'See you there!', 'This is a SAMPLE profile — invite a friend to try the real thing 💬']
export const sampleReply = (n: number) => REPLIES[Math.min(n, REPLIES.length - 1)]
