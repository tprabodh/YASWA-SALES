// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';


// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCVmoKrSvbOlVzNftVEWq7UVyyP-LaNFnU",
    authDomain: "yaswa-smd.firebaseapp.com",
    projectId: "yaswa-smd",
    storageBucket: "yaswa-smd.firebasestorage.app",
    messagingSenderId: "782253021763",
    appId: "1:782253021763:web:57619636e6d5114f4312f6",
    measurementId: "G-JK98N1DVSF"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);

// Export the services for use in other parts of your app
export { auth, db };
