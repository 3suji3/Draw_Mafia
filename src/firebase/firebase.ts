import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const FALLBACK_FIREBASE_CONFIG = {
  apiKey: "demo-api-key",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo-project",
  storageBucket: "demo.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:demo",
};

function readFirebaseEnv(key: keyof typeof FALLBACK_FIREBASE_CONFIG): string {
  const value = process.env[`NEXT_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (char) => `_${char}`).toUpperCase()}`];
  return value && value.trim().length > 0 ? value : FALLBACK_FIREBASE_CONFIG[key];
}

const firebaseConfig = {
  apiKey: readFirebaseEnv("apiKey"),
  authDomain: readFirebaseEnv("authDomain"),
  projectId: readFirebaseEnv("projectId"),
  storageBucket: readFirebaseEnv("storageBucket"),
  messagingSenderId: readFirebaseEnv("messagingSenderId"),
  appId: readFirebaseEnv("appId"),
};

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const db = getFirestore(firebaseApp);
