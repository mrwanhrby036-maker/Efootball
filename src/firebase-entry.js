/* نقطة تجميع Firebase — كل ما تحتاجه المنصة من SDK في حزمة واحدة محلية */
export {
  initializeApp, getApps, deleteApp, getApp
} from 'firebase/app';

export {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  linkWithPopup,
  sendPasswordResetEmail,
  updatePassword,
  verifyBeforeUpdateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  linkWithPhoneNumber,
  PhoneAuthProvider,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  deleteUser
} from 'firebase/auth';

export {
  getFirestore,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  increment,
  writeBatch,
  deleteField,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';

export {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  Schema
} from 'firebase/ai';
