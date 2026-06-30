import {
    getAuth,
    signInWithEmailAndPassword
} from "./confige/firebase.js";

const auth = getAuth();

const lEmail = document.getElementById('lEmail');
const lPassword = document.getElementById('lPassword');
const lLoginBtn = document.getElementById('lLoginBtn');

lLoginBtn.addEventListener("click", () => {
    signInWithEmailAndPassword(auth, lEmail.value, lPassword.value)
        .then((userCredential) => {
            const user = userCredential.user;
            window.location.href = "newfile.html"
            console.log(user);
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.log(errorCode);
            console.log(errorMessage);
        });
})