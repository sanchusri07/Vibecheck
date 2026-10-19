
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCqQ3sn_SHdbOkl2OMSI9EBkAT8cNg5NPM",
  authDomain: "vibecheck-3f73c.firebaseapp.com",
  projectId: "vibecheck-3f73c",
  storageBucket: "vibecheck-3f73c.firebasestorage.app",
  messagingSenderId: "972005569714",
  appId: "1:972005569714:web:a635cda79faa4f1e7e45ab",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
