import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
export type PrivateLocation={latitude:number;longitude:number;accuracy:number;timestamp:number}
export async function saveProfile(uid:string,data:{subjectName:string;email:string|null;locationSignal:string;locationConsent:boolean}){if(!db)throw new Error('Firestore is unavailable');await setDoc(doc(db,'users',uid),{...data,modelVersion:'V7.3',updatedAt:serverTimestamp()},{merge:true})}
export async function saveResult(uid:string,data:{subjectName:string;archetype:string;archetypeCode:string;matchScore:number;personalityVector:number[];rankedArchetypes:{name:string;code:string;score:number}[];locationSignal:string}){if(!db)throw new Error('Firestore is unavailable');return addDoc(collection(db,'users',uid,'results'),{...data,modelVersion:'V7.3',createdAt:serverTimestamp()})}
// Precise GPS only. Written to users/{uid}/location/{locationId} — the subcollection firestore.rules
// already restricts to owner-only read/create/update. Never merged into the main profile doc or
// the results subcollection, so it can't ride along with anything shown during discovery/matching.
export async function saveLocationCoordinate(uid:string,coordinate:PrivateLocation){if(!db)throw new Error('Firestore is unavailable');return addDoc(collection(db,'users',uid,'location'),{...coordinate,createdAt:serverTimestamp()})}
