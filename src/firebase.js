import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyC7CczhTh3t0px6BdmcxlbVtPXmu9yz3rk",
  authDomain: "warehouse-app-7841a.firebaseapp.com",
  databaseURL: "https://warehouse-app-7841a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "warehouse-app-7841a",
  storageBucket: "warehouse-app-7841a.firebasestorage.app",
  messagingSenderId: "272439852723",
  appId: "1:272439852723:web:0cc38c7db0157610bebac6",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
