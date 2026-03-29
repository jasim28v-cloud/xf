// ⚠️ ضع إعدادات Firebase الخاصة بمشروع coco-88863 هنا
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "coco-88863.firebaseapp.com",
    databaseURL: "https://coco-88863-default-rtdb.firebaseio.com",
    projectId: "coco-88863",
    storageBucket: "coco-88863.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

const CLOUD_NAME = 'dnillsbmi';
const UPLOAD_PRESET = 'ekxzvogb';

console.log('✅ InstaClone Ready');
