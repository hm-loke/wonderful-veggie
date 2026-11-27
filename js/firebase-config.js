// =========================================================================
// FIREBASE CONFIGURATION (Same stack as Xpress Auto Enterprise)
// Paste your Wonderful Veggie Firebase Web App config below when ready.
// Until configured, the site automatically uses local fallback data so you
// can preview and test everything immediately in VS Code!
// =========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDvsVmxX66pORobnORN4cOHJ6PaofS-hFQ",
  authDomain: "wonderful-veggie-c76ff.firebaseapp.com",
  projectId: "wonderful-veggie-c76ff",
  storageBucket: "wonderful-veggie-c76ff.firebasestorage.app",
  messagingSenderId: "705270850479",
  appId: "1:705270850479:web:a9e9b98c32bacd4d1b455a"
};

export const isFirebaseConfigured =
  firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("AIzaSyDvsVmxX66pORobnORN4cOHJ6PaofS-hFQ");

let db = null;
let auth = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
}

export { db, auth, googleProvider };