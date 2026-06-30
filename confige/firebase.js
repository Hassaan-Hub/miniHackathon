import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import { 
    getFirestore,
    doc, 
    setDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCHHPQXm_cZKPX5qkOVJwnA8wQ__Xv5NC0",
    authDomain: "saylani-hackathon-b798c.firebaseapp.com",
    projectId: "saylani-hackathon-b798c",
    storageBucket: "saylani-hackathon-b798c.firebasestorage.app",
    messagingSenderId: "239830522094",
    appId: "1:239830522094:web:8f377ca39daed86288fbff",
    measurementId: "G-HBT0Z6KE67"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app)
const db = getFirestore(app)

export {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    doc,
    setDoc,
    db,
    getFirestore,
    app
}