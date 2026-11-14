'use client'

import { initializeApp, getApps, getApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, GoogleAuthProvider, setPersistence, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDQQMTFQ8W0mj0jGdvdeVxIB8kgc419OaU',
  authDomain: 'vit-pulse.firebaseapp.com',
  projectId: 'vit-pulse',
  storageBucket: 'vit-pulse.firebasestorage.app',
  messagingSenderId: '208680450066',
  appId: '1:208680450066:web:06fcae6d6431a799af40cb',
  measurementId: 'G-32DR3BLRTE',
}

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean)
const app = firebaseConfigured ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function signInWithGoogle() {
  if (!auth) throw new Error('Firebase Authentication is unavailable. Check the Firebase project configuration.')
  await setPersistence(auth, browserLocalPersistence)
  return signInWithPopup(auth, googleProvider)
}
export async function signOut() { if (auth) await firebaseSignOut(auth) }
