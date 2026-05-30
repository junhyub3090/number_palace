// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCUseyo9XJdu9jiypGkqCiXfdwHyCnAlKA",
  authDomain: "number-palace.firebaseapp.com",
  projectId: "number-palace",
  storageBucket: "number-palace.firebasestorage.app",
  messagingSenderId: "921331808127",
  appId: "1:921331808127:web:a95aef9d49dd5a502b8c4a",
  measurementId: "G-L7W49TE73J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };
