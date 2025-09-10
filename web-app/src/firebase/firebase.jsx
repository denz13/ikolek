import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase config from .env
const firebaseConfig = {
  apiKey: "AIzaSyAAppP6QCVs4p6k1zFeiQXNCX8D_ysD_4A",
  authDomain: "ikolek-ba6d1.firebaseapp.com",
  projectId: "ikolek-ba6d1",
  storageBucket: "ikolek-ba6d1.firebasestorage.app",
  messagingSenderId: "574522796555",
  appId: "1:574522796555:web:44b03cf6d191c26026f50e"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
