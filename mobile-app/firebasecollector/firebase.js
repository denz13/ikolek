// ../firebasecollector/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStorage } from "firebase/storage";

// --- Your Firebase config (bucket must be *.appspot.com)
const firebaseConfig = {
  apiKey: "AIzaSyBmyCLCMS0H6UnsUbrTgi0dv7p1aat6k_w",
  authDomain: "ikolek-ba6d1.firebaseapp.com",
  projectId: "ikolek-ba6d1",
  storageBucket: "ikolek-ba6d1.firebasestorage.app",
  messagingSenderId: "574522796555",
  appId: "1:574522796555:web:44b03cf6d191c26026f50e"
};


// Guard against re-initialization during Fast Refresh
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Auth with RN persistence (Android only)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Firestore & Storage
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
