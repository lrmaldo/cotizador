// Import functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// TODO: Reemplaza la configuración siguiente con la de tu proyecto en Firebase Console
const firebaseConfig = {
  // TODO: Reemplaza estos valores con los reales de tu proyecto
  // Ve a Firebase Console > Project Settings (Engranaje) > General > Your apps
  apiKey: "AIzaSyAa9YudIdR9_iGTS8i8nlXG7IC4sZvLn8Y",
  authDomain: "leo-cotizador.firebaseapp.com",
  projectId: "leo-cotizador",
  storageBucket: "leo-cotizador.firebasestorage.app",
  messagingSenderId: "416101745946",
  appId: "1:416101745946:web:aa326a1a13c6a7f92c18a3",
  measurementId: "G-3G34EW5S16"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
