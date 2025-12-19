import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCRiYmecHgrdBiDL077EpRkvG_ylqJRrAI',
  authDomain: 'table-ht.firebaseapp.com',
  projectId: 'table-ht',
  storageBucket: 'table-ht.firebasestorage.app',
  messagingSenderId: '344356846018',
  appId: '1:344356846018:web:93910af0cf1ed6db01be5b',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

/** Инициализация Firestore с включённым IndexedDB persistence */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager(),
  }),
});
