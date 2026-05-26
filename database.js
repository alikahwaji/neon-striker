// database.js
// Firebase Web SDK integration for global high scores database in NEON STRIKER

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-analytics.js";

// Active Firebase Configuration Credentials
const firebaseConfig = {
  apiKey: "AIzaSyDB13eMYLEjLww-e3Zsbc3cNgZd0Oz14tQ",
  authDomain: "neon-striker-70d7c.firebaseapp.com",
  projectId: "neon-striker-70d7c",
  storageBucket: "neon-striker-70d7c.firebasestorage.app",
  messagingSenderId: "749292733547",
  appId: "1:749292733547:web:ae91f74e9cb5a5430edd2e",
  measurementId: "G-W2BZWYD449"
};

let db = null;
let analytics = null;
let enabled = false;

// Check if credentials are placeholders
const isPlaceholder = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("YOUR_API_KEY");

if (!isPlaceholder) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    enabled = true;
    console.log("🚀 Neon Striker: Global Serverless Database Initialized Successfully!");
    
    // Initialize Analytics if measurementId exists
    if (firebaseConfig.measurementId) {
      analytics = getAnalytics(app);
      console.log("📊 Neon Striker: Firebase Analytics Active!");
    }
  } catch (error) {
    console.error("⚠️ Neon Striker Database Initialization Failed:", error);
    enabled = false;
  }
} else {
  console.log("⚙️ Neon Striker: Using Local Browser Database (Firebase credentials not configured yet).");
}

// Expose status and methods globally to game.js
window.firebaseEnabled = enabled;

window.getGlobalHighScores = async function() {
  if (!enabled || !db) return null;
  
  try {
    const q = query(
      collection(db, "leaderboard"),
      orderBy("score", "desc"),
      limit(8)
    );
    const querySnapshot = await getDocs(q);
    const scores = [];
    querySnapshot.forEach((doc) => {
      scores.push(doc.data());
    });
    return scores;
  } catch (error) {
    console.error("Error loading scores from Firebase Firestore:", error);
    return null;
  }
};

window.saveGlobalHighScore = async function(name, score) {
  if (!enabled || !db) return false;
  
  try {
    await addDoc(collection(db, "leaderboard"), {
      name: name.toUpperCase().slice(0, 12),
      score: parseInt(score) || 0,
      timestamp: serverTimestamp()
    });
    console.log(`Saved Global Score: ${name} - ${score}`);
    return true;
  } catch (error) {
    console.error("Error saving score to Firebase Firestore:", error);
    return false;
  }
};

window.logAnalyticsEvent = function(eventName, eventParams = {}) {
  if (enabled && analytics) {
    try {
      logEvent(analytics, eventName, eventParams);
    } catch (e) {
      console.warn("Analytics event tracking failed:", e);
    }
  }
};
