import { getAuth, createUserWithEmailAndPassword } from "./confige/firebase.js";

const auth = getAuth();

const sEmail = document.getElementById('sEmail');
const sPassword = document.getElementById('sPassword');
const sSignupBtn = document.getElementById('sSignupBtn');

sSignupBtn.addEventListener("click", () => {
  createUserWithEmailAndPassword(auth, sEmail.value, sPassword.value)
    .then((userCredential) => {
      // Signed up 
      const user = userCredential.user;
      window.location.href = "login.html"
      console.log(user);
    })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      console.log(errorCode);
      console.log(errorMessage);

    });
})