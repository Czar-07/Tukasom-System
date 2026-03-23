/* =========================================================
   FIREBASE CONFIG — TUKASOM
========================================================= */

/* ================= IMPORTS ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ================= CONFIGURAÇÃO ================= */
const firebaseConfig = {
  apiKey: "AIzaSyDYYTCw_96Fl6se9fhR2QscXNGM3HGjL44",
  authDomain: "tukasom-system.firebaseapp.com",
  projectId: "tukasom-system",
  storageBucket: "tukasom-system.firebasestorage.app",
  messagingSenderId: "631668908437",
  appId: "1:631668908437:web:331f174d4e4785106a969c"
};

/* ================= INICIALIZAÇÃO ================= */
const app = initializeApp(firebaseConfig);

/* ================= SERVIÇOS ================= */
export const db = getFirestore(app);
export const auth = getAuth(app);

/* ================= PERSISTÊNCIA DE LOGIN ================= */
/*
  Mantém o usuário logado mesmo após fechar o navegador.
*/
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Erro ao configurar persistência:", error);
  });

/* ================= PERMISSÕES ================= */
/*
  Lista de e-mails autorizados como administradores.
  Pode ser substituída futuramente por roles no banco.
*/
export const ADMIN_EMAILS = [
  "admin@tukasom.com",
  "admin2@tukasom.com"
];