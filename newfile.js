import {
    toGetLoggedInUser,
    logOutUser,
    getAllDetails,
} from "./confige/firebase.js";

toGetLoggedInUser()


const logout = document.getElementById("logout");

logout.addEventListener('click', () => {
    console.log('--> log out chal gaya');
    logOutUser()
})

const userData = await getAllDetails()
console.log(userData);
