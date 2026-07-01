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
  try {
  const userCredential =
    await createUserWithEmailAndPassword(
      auth,
      sEmail.value,
      sPassword.value
    );

  const user = userCredential.user;
console.log("User UID:", user.uid);
  await setDoc(doc(db, "users", user.uid), {
    name: sName.value,
    email: sEmail.value,
    profession: sProfession.value,
    uid: user.uid,
  });

  console.log("Success");
} catch (error) {
  console.log(error.code);
  console.log(error.message);
  console.log(error);
}
})
