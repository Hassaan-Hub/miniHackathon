import {
  getAuth,
  createUserWithEmailAndPassword,
  doc,
  db,
  setDoc,
}
  from "./confige/firebase.js";

const auth = getAuth();

const sName = document.getElementById('sName');
const sEmail = document.getElementById('sEmail');
const sPassword = document.getElementById('sPassword');
const sProfession = document.getElementById('sProfession');
const sSignupBtn = document.getElementById('sSignupBtn');

sSignupBtn.addEventListener("click", async () => {
  const userCredential = await createUserWithEmailAndPassword(auth, sEmail.value, sPassword.value);
  try {
    const user = await userCredential.user;
    await setDoc(doc(db, "users", user.uid), {
      name: sName.value,
      email: sEmail.value,
      password: sPassword.value,
      profession: sProfession.value,
      uid: user.uid
    });
    console.log("user created successfully + edit user data");
    // window.location.href = "login.html"
  } catch (error) {
    const errorCode = error.code;
    const errorMessage = error.message;
    console.log(errorCode);
    console.log(errorMessage);
  };
})

