import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, update, get, child } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAxtEkrEgl0C9djPkxKKX-sENtOzPEbHB8",
    authDomain: "tope-e5350.firebaseapp.com",
    databaseURL: "https://tope-e5350-default-rtdb.firebaseio.com",
    projectId: "tope-e5350",
    storageBucket: "tope-e5350.firebasestorage.app",
    messagingSenderId: "187788115549",
    appId: "1:187788115549:web:5012a1053d2ff7dced97b4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

export { ref, push, set, onValue, update, get, child };

// Cloudinary Configuration
export const CLOUD_NAME = 'dnmpmysk6';
export const UPLOAD_PRESET = 'rsxdfdgw';

console.log('✅ Firebase initialized');
