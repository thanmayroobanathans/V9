import type { PublicProfile } from './dating'
import { QUESTIONS, classify, scoreAnswers } from './pulse-model'

/**
 * Preview deck. These are fictional, clearly labelled SAMPLE profiles that live only in the
 * browser — they are never written to Firestore and are hidden once real students exist
 * (or when "Preview with sample profiles" is switched off in Settings).
 */
const seed = (n: number) => () => { n = (n * 9301 + 49297) % 233280; return n / 233280 }
const raw: Omit<PublicProfile, 'uid' | 'vector' | 'archetype' | 'archetypeCode' | 'campusSignal' | 'discoverable' | 'photoURL'>[] = [
  { name: 'Ananya', age: 20, gender: 'woman', seeking: 'men', intent: 'dating', year: '3rd year', program: 'CSE', bio: 'Debugging code by day, debugging my sleep schedule by night. Will trade chai for good playlists.', interests: ['Music', 'Coding', 'Chai', 'Night walks'], prompts: [{ q: 'A perfect Sunday on campus looks like…', a: 'Late breakfast, library window seat, sunset at the lake.' }, { q: 'Green flags I look for…', a: 'You text back in full sentences.' }], hue: 340 },
  { name: 'Rohan', age: 21, gender: 'man', seeking: 'women', intent: 'relationship', year: '4th year', program: 'ECE', bio: 'Robotics club, badminton at 6 AM, and an unreasonable love for filter coffee.', interests: ['Robotics', 'Badminton', 'Coffee', 'Startups'], prompts: [{ q: 'I geek out on…', a: 'Drones. I will show you the one I built. Twice.' }, { q: 'We will get along if…', a: 'You are okay with spontaneous Vellore food runs.' }], hue: 210 },
  { name: 'Meera', age: 19, gender: 'woman', seeking: 'everyone', intent: 'friends', year: '2nd year', program: 'BBA', bio: 'Riviera volunteer, part-time poet, full-time overthinker.', interests: ['Poetry', 'Riviera', 'Dance', 'K-drama'], prompts: [{ q: 'The way to win me over is…', a: 'Remember the small things I mention once.' }, { q: 'Two truths and a lie…', a: 'I have met a Bollywood actor, I can solve a Rubik cube, I hate mangoes.' }], hue: 280 },
  { name: 'Arjun', age: 22, gender: 'man', seeking: 'women', intent: 'dating', year: '4th year', program: 'Mechanical', bio: 'Gym, cricket, and planning trips I never take. Help me actually take one.', interests: ['Gym', 'Cricket', 'Travel', 'Movies'], prompts: [{ q: 'My go-to Foodys order is…', a: 'Paneer roll and a cold coffee, no debate.' }, { q: 'My most irrational fear is…', a: 'Lab viva questions I have not heard before.' }], hue: 25 },
  { name: 'Ishita', age: 20, gender: 'woman', seeking: 'men', intent: 'figuring-out', year: '3rd year', program: 'Biotech', bio: 'Photographing every sunset on campus. Ask me for my top 3 spots.', interests: ['Photography', 'Art', 'Travel', 'Coffee'], prompts: [{ q: 'A perfect Sunday on campus looks like…', a: 'Golden hour photo walk, then a long dinner conversation.' }, { q: 'I geek out on…', a: 'Film cameras and why grain looks better.' }], hue: 15 },
  { name: 'Kabir', age: 20, gender: 'man', seeking: 'everyone', intent: 'friends', year: '2nd year', program: 'CSE (AI)', bio: 'Hackathon addict. 3 wins, 11 losses, 0 regrets.', interests: ['Hackathons', 'Gaming', 'Anime', 'Startups'], prompts: [{ q: 'We will get along if…', a: 'You can argue about the best anime arc for an hour.' }, { q: 'Green flags I look for…', a: 'Curiosity about literally anything.' }], hue: 160 },
  { name: 'Sana', age: 21, gender: 'woman', seeking: 'men', intent: 'relationship', year: '4th year', program: 'Architecture', bio: 'I notice buildings before people. Working on it. Slowly.', interests: ['Art', 'Reading', 'Podcasts', 'Cooking'], prompts: [{ q: 'The way to win me over is…', a: 'A handwritten note. Old school works.' }, { q: 'My most irrational fear is…', a: 'Elevators in old buildings.' }], hue: 45 },
  { name: 'Dev', age: 19, gender: 'man', seeking: 'women', intent: 'dating', year: '1st year', program: 'IT', bio: 'New here. Know the best shortcuts to TT already. Guitarist on weekends.', interests: ['Music', 'Football', 'Gaming', 'Night walks'], prompts: [{ q: 'I geek out on…', a: 'Guitar tones and pedals.' }, { q: 'My go-to Foodys order is…', a: 'Maggi. Every time. Judge me.' }], hue: 190 },
  { name: 'Tara', age: 20, gender: 'nonbinary', seeking: 'everyone', intent: 'dating', year: '3rd year', program: 'Design', bio: 'Thrifting, sketching strangers (with permission), and mild chaos.', interests: ['Fashion', 'Art', 'Movies', 'Volunteering'], prompts: [{ q: 'Two truths and a lie…', a: 'I have 40 sketchbooks, I can whistle, I have never had coffee.' }, { q: 'We will get along if…', a: 'You let me pick the movie once.' }], hue: 300 },
  { name: 'Nikhil', age: 21, gender: 'man', seeking: 'women', intent: 'relationship', year: '3rd year', program: 'EEE', bio: 'Debate captain. I will lose arguments to you on purpose. Maybe.', interests: ['Debate', 'Reading', 'Chai', 'Podcasts'], prompts: [{ q: 'Green flags I look for…', a: 'Disagreeing with me kindly.' }, { q: 'A perfect Sunday on campus looks like…', a: 'Chai at the gazebo and a long walk with no destination.' }], hue: 230 },
]

export const SAMPLE_PROFILES: PublicProfile[] = raw.map((p, i) => {
  const r = seed(i * 7919 + 13)
  // Built from simulated quiz answers so sample vectors look like real calibrations.
  const vector = scoreAnswers(QUESTIONS.map(() => Math.floor(r() * 4))).map(v => Math.round(v * 100) / 100)
  const c = classify(vector).primary
  return { ...p, uid: `sample-${i}`, vector, archetype: c.name, archetypeCode: c.code, campusSignal: 'ON CAMPUS', discoverable: true, photoURL: null, sample: true }
})

const REPLIES = ['Haha okay you have my attention 😄', 'That is a great question actually. Give me a sec to think.', 'Okay but you first!', 'Honestly? Gazebo. Every time.', 'This is a sample profile — invite a friend to try the real thing 💌']
export const sampleReply = (n: number) => REPLIES[Math.min(n, REPLIES.length - 1)]
/** Sample profiles "like you back" deterministically when compatibility is decent. */
export const sampleLikesBack = (score: number, kind: 'like' | 'super') => kind === 'super' || score >= 64
