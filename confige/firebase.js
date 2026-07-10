import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  GithubAuthProvider,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

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
const auth = getAuth(app)
const db = getFirestore(app)
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();


function signupFunction(name, email, password, profession) {
  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;

      setDoc(doc(db, "users", user.uid), {
        name: name,
        email: email,
        password: password,
        profession: profession
      })
        .then(() => {
          console.log("Record have save in Database");
        })
        .catch(() => {
          console.log("Record have error in Database");
        })

      // window.location.href = "/login.html"
      console.log(user, "--> signup successfully");
    })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      console.log(errorCode);
      console.log(errorMessage);
    });
}



function loginFunction(email, password) {
  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      window.location.href = "/newfile.html"
      console.log(user, "--> login successfully");
    })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      console.log(errorCode);
      console.log(errorMessage);
    });
}


function toGetLoggedInUser() {
  onAuthStateChanged(auth, (user) => {
    console.log("--> kya user mila??");

    if (user) {
      const uid = user.uid;
      console.log(uid, "--> user uid");

      if (window.location.pathname !== "/newfile.html") {
        window.location = "/newfile.html"
      }

    } else {
      console.log('--> user is not login ');

      if (window.location.pathname == "/signup.html" || window.location.pathname == "/login.html") {
        console.log("--> already login ya signup ke page pe hun");
      } else {
        window.location.pathname == "/login.html"
      }
    }
  });
}

function logOutUser() {
  signOut(auth).then(() => {
    window.location = "./login.html"
  }).catch((error) => {
  });
}

async function getSingleUserDetails(uniqueId) {

  const docRef = doc(db, "users", uniqueId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    console.log("Document data:", docSnap.data());
  } else {
    // docSnap.data() will be undefined in this case
    console.log("No such document!");
  }
}


async function getAllDetails() {
  const q = query(collection(db, "users"));
  const userArr = [];

  const querySnapshot = await getDocs(q);
  querySnapshot.forEach((doc) => {
    // console.log(doc.id, " => ", doc.data());
    userArr.push(doc.data())
  });
  // userArr.forEach(()=>{
    
  // })
  return ""
}


function googleSignup() {
  signInWithPopup(auth, googleProvider)
    .then((result) => {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;
      const user = result.user;
      console.log(user);
    }).catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      const email = error.customData.email;
      const credential = GoogleAuthProvider.credentialFromError(error);
      console.log(errorCode);
      console.log(errorMessage);
      console.log(credential);
    });
}


function githubsignup() {
  signInWithPopup(auth, githubProvider)
    .then((result) => {
      const credential = GithubAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;
      const user = result.user;
      console.log(user);

    }).catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      const email = error.customData.email;
      const credential = GithubAuthProvider.credentialFromError(error);
      console.log(errorCode);
      console.log(errorMessage);
      console.log(credential);
      console.log(error);
    });
}



export {
  signupFunction,
  loginFunction,
  getSingleUserDetails,
  getAllDetails,
  toGetLoggedInUser,
  googleSignup,
  githubsignup,
  logOutUser
}