// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAn2WnjmRiKl4V9SLOUPCZphQK2CzJf3U4",
  authDomain: "control-horas-29ca0.firebaseapp.com",
  projectId: "control-horas-29ca0",
  storageBucket: "control-horas-29ca0.firebasestorage.app",
  messagingSenderId: "160745613313",
  appId: "1:160745613313:web:eac7650ffcdac06bd7f800",
  measurementId: "G-GW2EQ703RC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Exportar los servicios necesarios para el resto de la app
export const db = getFirestore(app);
export const auth = getAuth(app);
