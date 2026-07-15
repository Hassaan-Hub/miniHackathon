import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, browserLocalPersistence, setPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCTYO_2j7fmlTSofaHTmkpta1ckM7B4Hro",
  authDomain: "my-first-project-d9a04.firebaseapp.com",
  projectId: "my-first-project-d9a04",
  storageBucket: "my-first-project-d9a04.firebasestorage.app",
  messagingSenderId: "857518158920",
  appId: "1:857518158920:web:6f6bd4d1bb37062fe1547d",
  measurementId: "G-2BVM55BVS7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

setPersistence(auth, browserLocalPersistence);