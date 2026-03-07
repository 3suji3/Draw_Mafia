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

const envFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isFirebaseEnvReady = Object.values(envFirebaseConfig).every(
  (value) => typeof value === "string" && value.trim().length > 0
);

const firebaseConfig = isFirebaseEnvReady
  ? {
      apiKey: envFirebaseConfig.apiKey!,
      authDomain: envFirebaseConfig.authDomain!,
      projectId: envFirebaseConfig.projectId!,
      storageBucket: envFirebaseConfig.storageBucket!,
      messagingSenderId: envFirebaseConfig.messagingSenderId!,
      appId: envFirebaseConfig.appId!,
    }
  : FALLBACK_FIREBASE_CONFIG;

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const db = getFirestore(firebaseApp);
