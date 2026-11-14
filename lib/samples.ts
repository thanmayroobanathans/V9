import type { Person } from './social'
import { QUESTIONS, classify } from './pulse-model'
import { estimateTraits } from './trait-kalman'
import { jungFromAnswers } from './jung'
import { areaCode, type Nature } from './nature'

/**
 * Preview content: fictional, clearly labelled SAMPLE people that live only in the browser —
 * never written to Firestore — so swiping, matching and chat can be tried before other students
 * join. Toggle off in Settings.
 */
const DEFAULT_AREA = areaCode(12.9692, 79.1559) // VIT Vellore

const seed = (n: number) => () => { n = (n * 9301 + 49297) % 233280; return n / 233280 }

type Raw = Pick<Person, 'name' | 'program' | 'year' | 'bio' | 'status' | 'interests' | 'openTo' | 'hue'> & Partial<Pick<Person, 'age' | 'gender' | 'seeking' | 'intent' | 'prompts'>> & { mins: number; near: boolean }

const RAW: Raw[] = [
  { name: 'Ananya', age: 20, gender: 'woman', seeking: 'men', intent: 'long-term', prompts: [{ q: 'A perfect Sunday on campus looks like…', a: 'Late breakfast, library window seat, sunset at the lake.' }, { q: 'Green flags I look for…', a: 'You text back in full sentences.' }], program: 'CSE', year: '3rd year', bio: 'Debugging code by day, debugging my sleep schedule by night.', status: 'Grinding DSA, need a study buddy', interests: ['Coding', 'Music', 'Chai'], openTo: ['Study buddy', 'Just chatting'], hue: 340, mins: 3, near: true },
  { name: 'Rohan', age: 21, gender: 'man', seeking: 'women', intent: 'long-term', prompts: [{ q: 'I geek out on…', a: 'Drones. I will show you the one I built. Twice.' }, { q: 'We will get along if…', a: 'You are okay with spontaneous food runs.' }], program: 'ECE', year: '4th year', bio: 'Robotics club, badminton at 6 AM, unreasonable love for filter coffee.', status: 'Anyone up for badminton at 6?', interests: ['Robotics', 'Badminton', 'Coffee'], openTo: ['Sports', 'Project team'], hue: 210, mins: 8, near: true },
  { name: 'Meera', age: 19, gender: 'woman', seeking: 'everyone', intent: 'friends', prompts: [{ q: 'The way to win me over is…', a: 'Remember the small things I mention once.' }, { q: 'Two truths and a lie…', a: 'I have met a film star, I can solve a Rubik cube, I hate mangoes.' }], program: 'BBA', year: '2nd year', bio: 'Riviera volunteer, part-time poet, full-time overthinker.', status: 'Planning a poetry open mic 🎤', interests: ['Poetry', 'Riviera', 'Dance'], openTo: ['Just chatting', 'Exploring campus'], hue: 280, mins: 15, near: false },
  { name: 'Arjun', age: 22, gender: 'man', seeking: 'women', intent: 'casual', prompts: [{ q: 'My go-to Foodys order is…', a: 'Paneer roll and a cold coffee, no debate.' }, { q: 'My most irrational fear is…', a: 'Lab viva questions I have not heard before.' }], program: 'Mechanical', year: '4th year', bio: 'Gym, cricket, and planning trips I never take.', status: 'Foodys run in 10, who is in?', interests: ['Gym', 'Cricket', 'Travel'], openTo: ['Food runs', 'Sports'], hue: 25, mins: 1, near: true },
  { name: 'Ishita', age: 20, gender: 'woman', seeking: 'men', intent: 'open', prompts: [{ q: 'A perfect Sunday on campus looks like…', a: 'Golden hour photo walk, then a long dinner conversation.' }, { q: 'I geek out on…', a: 'Film cameras and why grain looks better.' }], program: 'Biotech', year: '3rd year', bio: 'Photographing every sunset on campus. Ask me for my top 3 spots.', status: 'Golden hour photo walk today', interests: ['Photography', 'Art', 'Travel'], openTo: ['Exploring campus', 'Just chatting'], hue: 15, mins: 25, near: false },
  { name: 'Kabir', age: 20, gender: 'man', seeking: 'everyone', intent: 'friends', prompts: [{ q: 'We will get along if…', a: 'You can argue about the best anime arc for an hour.' }, { q: 'Green flags I look for…', a: 'Curiosity about literally anything.' }], program: 'CSE (AI)', year: '2nd year', bio: 'Hackathon addict. 3 wins, 11 losses, 0 regrets.', status: 'Looking for 2 people for a hackathon', interests: ['Hackathons', 'Gaming', 'Anime'], openTo: ['Project team', 'Gaming'], hue: 160, mins: 5, near: true },
  { name: 'Sana', age: 21, gender: 'woman', seeking: 'men', intent: 'long-term', prompts: [{ q: 'The way to win me over is…', a: 'A handwritten note. Old school works.' }, { q: 'My most irrational fear is…', a: 'Elevators in old buildings.' }], program: 'Architecture', year: '4th year', bio: 'I notice buildings before people. Working on it.', status: 'Sketching near the main building', interests: ['Art', 'Reading', 'Podcasts'], openTo: ['Just chatting'], hue: 45, mins: 90, near: false },
  { name: 'Dev', age: 19, gender: 'man', seeking: 'women', intent: 'casual', prompts: [{ q: 'I geek out on…', a: 'Guitar tones and pedals.' }, { q: 'My go-to Foodys order is…', a: 'Maggi. Every time. Judge me.' }], program: 'IT', year: '1st year', bio: 'New here. Guitarist on weekends. Show me around?', status: 'New to campus — show me around?', interests: ['Music', 'Football', 'Gaming'], openTo: ['Jam session', 'Exploring campus'], hue: 190, mins: 2, near: true },
  { name: 'Tara', age: 20, gender: 'nonbinary', seeking: 'everyone', intent: 'open', prompts: [{ q: 'Two truths and a lie…', a: 'I have 40 sketchbooks, I can whistle, I have never had coffee.' }, { q: 'We will get along if…', a: 'You let me pick the movie once.' }], program: 'Design', year: '3rd year', bio: 'Thrifting, sketching strangers (with permission), mild chaos.', status: 'Free for coffee after 4', interests: ['Fashion', 'Art', 'Movies'], openTo: ['Food runs', 'Just chatting'], hue: 300, mins: 40, near: false },
  { name: 'Nikhil', age: 21, gender: 'man', seeking: 'women', intent: 'long-term', prompts: [{ q: 'Green flags I look for…', a: 'Disagreeing with me kindly.' }, { q: 'A perfect Sunday on campus looks like…', a: 'Chai at the gazebo and a long walk with no destination.' }], program: 'EEE', year: '3rd year', bio: 'Debate captain. Will argue about anything, kindly.', status: 'Debate practice at 7, join us', interests: ['Debate', 'Reading', 'Chai'], openTo: ['Study buddy', 'Just chatting'], hue: 230, mins: 12, near: false },
]

const NATURES: Nature[] = [
  { roam: 0.35, variety: 0.3, routine: 0.75, active: 0.2, night: 0.25, early: 0.02, confidence: 0.8 },
  { roam: 0.6, variety: 0.5, routine: 0.5, active: 0.5, night: 0.02, early: 0.3, confidence: 0.7 },
  { roam: 0.7, variety: 0.8, routine: 0.3, active: 0.45, night: 0.15, early: 0.05, confidence: 0.6 },
  { roam: 0.55, variety: 0.45, routine: 0.55, active: 0.55, night: 0.1, early: 0.1, confidence: 0.9 },
]

/** Sample people; `myArea` places some of them in the viewer's own part of campus. */
export function samplePeople(myArea: string | null): Person[] {
  const now = Date.now(), area = myArea ?? DEFAULT_AREA
  return RAW.map((p, i) => {
    const r = seed(i * 7919 + 13)
    const answers = QUESTIONS.map(() => Math.floor(r() * 4))
    const est = estimateTraits(answers), vector = est.vector
    const c = classify(vector).primary
    const { mins, near, ...rest } = p
    return {
      age: 20, gender: 'woman', seeking: 'everyone', intent: 'open', prompts: [], ...rest,
      uid: `sample-${i}`, username: `${p.name.toLowerCase()}.sample`, vector, certainty: est.certainty, jung: jungFromAnswers(answers), archetype: c.name, archetypeCode: c.code, photoURL: null,
      nature: NATURES[i % NATURES.length], area: near ? area : area.slice(0, 5) + 'z', activeAt: now - mins * 60000, visible: true, sample: true,
    } as Person
  })
}

const REPLIES = ['Hey! 👋 Nice to match with you', 'Haha that is a good one. Okay, my turn to ask…', 'Sure, what time works for you?', 'See you there!', 'This is a SAMPLE profile — invite a friend to try the real thing 💬']
export const sampleReply = (n: number) => REPLIES[Math.min(n, REPLIES.length - 1)]
