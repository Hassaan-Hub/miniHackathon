import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDTGvL19AnOktVXHWoArmaeKWHQYVYwNDo",
  authDomain: "hackathon-5ba12.firebaseapp.com",
  projectId: "hackathon-5ba12",
  storageBucket: "hackathon-5ba12.firebasestorage.app",
  messagingSenderId: "16157655575",
  appId: "1:16157655575:web:3451eb4ece63a99cf15252",
  measurementId: "G-SV9D1DEZ4R"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
