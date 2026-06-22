import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC8EV3c-GBjSwtfDXufDLdspsutxl4vogc",
  authDomain: "recovery-crm-7e068.firebaseapp.com",
  projectId: "recovery-crm-7e068",
  storageBucket: "recovery-crm-7e068.firebasestorage.app",
  messagingSenderId: "969470946021",
  appId: "1:969470946021:web:690bf3fc8d20a3b824c20c",
  measurementId: "G-8GLLBZKZNS",
};

export const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

// Secondary app for creating dealer/customer accounts without disturbing admin session
let secondaryApp: FirebaseApp | null = null;
export function getSecondaryAuth() {
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, "Secondary");
  }
  return getAuth(secondaryApp);
}
