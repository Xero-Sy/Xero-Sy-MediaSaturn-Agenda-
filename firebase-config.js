import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDHggAB_zE2KCtUWxuFyyUwSaM-04tYRKo",
  authDomain: "xero-sy-mediasaturn-agenda.firebaseapp.com",
  projectId: "xero-sy-mediasaturn-agenda",
  storageBucket: "xero-sy-mediasaturn-agenda.firebasestorage.app",
  messagingSenderId: "933269931598",
  appId: "1:933269931598:web:374fa7f5a86ecc32cbe51f",
  measurementId: "G-5Y6YDTV8M7"
};

const app = initializeApp(firebaseConfig);
getAnalytics(app);

export const db = getFirestore(app);
