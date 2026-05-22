// database.js
// Firebase Web SDK integration for global high scores database in NEON STRIKER

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// REPLACE THIS CONFIGURATION with your own Firebase Project Credentials!
// To set this up:
// 1. Go to Firebase Console (https://console.firebase.google.com/)
// 2. Create a free project named "neon-striker"
// 3. Add a Web App to get your config object
// 4. Enable Cloud Firestore in "Test Mode" (or define read/write rules)
// 5. Replace this credentials block with your actual app config!
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let db = null;
let enabled = false;

// Check if credentials are placeholders
const isPlaceholder = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("YOUR_API_KEY");

if (!isPlaceholder) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    enabled = true;
    console.log("🚀 Neon Striker: Global Serverless Database Initialized Successfully!");
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
      name: name.toUpperCase().slice(0, 3),
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
