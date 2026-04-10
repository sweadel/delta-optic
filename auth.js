import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ═══════════════════════════════════════════════════════
//  🔥 FIREBASE CONFIG - Delta Optics System
// ═══════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyB11C4GGgAyqeThs8a9cvDNN7frvAA1nqQ",
  authDomain: "delta-optics-system.firebaseapp.com",
  projectId: "delta-optics-system",
  storageBucket: "delta-optics-system.firebasestorage.app",
  messagingSenderId: "111176219224",
  appId: "1:111176219224:web:e0d8a5f26b84d57249a82d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };

// ═══════════════════════════════════════════════════════
//  ✨ ENHANCED AUTH SYSTEM WITH ENCRYPTION & SESSION MGMT
// ═══════════════════════════════════════════════════════

export const Auth = {
  user: null,
  
  // ✅ Error Logger
  _logError: (context, error) => {
    console.error(`[Auth Error - ${context}]:`, error);
    if (window.logError) {
      window.logError(`Auth:${context}`, error);
    }
  },
  
  // ✅ Advanced Encryption
  _encrypt: (data) => {
    try {
      return btoa(encodeURIComponent(JSON.stringify(data)));
    } catch {
      return JSON.stringify(data);
    }
  },
  
  _decrypt: (data) => {
    try {
      return JSON.parse(decodeURIComponent(atob(data)));
    } catch {
      return JSON.parse(data);
    }
  },
  
  // ✅ Save User
  _saveUser: (userData) => {
    const encrypted = Auth._encrypt(userData);
    localStorage.setItem('auth_user', encrypted);
    localStorage.setItem('auth_timestamp', Date.now().toString());
  },
  
  // ✅ Load User with Session Validation
  _loadUser: () => {
    try {
      const encrypted = localStorage.getItem('auth_user');
      if (!encrypted) return null;
      
      const timestamp = parseInt(localStorage.getItem('auth_timestamp') || '0');
      const hoursPassed = (Date.now() - timestamp) / (1000 * 60 * 60);
      
      if (hoursPassed > 24) {
        Auth._clearUser();
        return null;
      }
      
      return Auth._decrypt(encrypted);
    } catch (error) {
      Auth._logError('loadUser', error);
      Auth._clearUser();
      return null;
    }
  },
  
  // ✅ Clear User
  _clearUser: () => {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_timestamp');
  },
  
  // ✅ Get User Data from Firestore
  _getUserData: async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (!userDoc.exists()) {
        return { success: false, msg: 'حساب غير موجود في النظام' };
      }
      
      const userData = userDoc.data();
      
      if (userData.status === 'frozen') {
        return { success: false, msg: 'هذا الحساب مجمد. تواصل مع الإدارة' };
      }
      
      return { success: true, data: userData };
    } catch (error) {
      Auth._logError('getUserData', error);
      return { success: false, msg: 'خطأ في الاتصال بقاعدة البيانات' };
    }
  },
  
  // ═══════════════════════════════════════════════════════
  //  🔐 LOGIN
  // ═══════════════════════════════════════════════════════
  
  login: async (email, password) => {
    try {
      if (!email || !password) {
        return { success: false, msg: 'البريد وكلمة المرور مطلوبان' };
      }
      
      const result = await signInWithEmailAndPassword(auth, email, password);
      const userDataResult = await Auth._getUserData(result.user.uid);
      
      if (!userDataResult.success) {
        await firebaseSignOut(auth);
        return userDataResult;
      }
      
      const userData = userDataResult.data;
      
      Auth.user = {
        uid: result.user.uid,
        email: email,
        name: userData.name,
        role: userData.role || 'employee',
        permissions: userData.permissions || [],
        fullData: userData
      };
      
      Auth._saveUser(Auth.user);
      return { success: true };
      
    } catch (error) {
      Auth._logError('login', error);
      
      const errorMessages = {
        'auth/invalid-credential': 'بريد أو كلمة مرور خاطئة',
        'auth/user-not-found': 'المستخدم غير موجود',
        'auth/wrong-password': 'كلمة المرور خاطئة',
        'auth/too-many-requests': 'محاولات كثيرة. حاول بعد قليل',
        'auth/network-request-failed': 'خطأ في الاتصال بالإنترنت',
        'auth/invalid-email': 'بريد إلكتروني غير صالح',
        'auth/user-disabled': 'هذا الحساب معطل'
      };
      
      return { 
        success: false, 
        msg: errorMessages[error.code] || 'خطأ في تسجيل الدخول' 
      };
    }
  },
  
  // ═══════════════════════════════════════════════════════
  //  🌐 GOOGLE LOGIN
  // ═══════════════════════════════════════════════════════
  
  loginWithGoogle: async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      
      let userData;
      
      if (!userDoc.exists()) {
        userData = {
          name: result.user.displayName || 'مستخدم Google',
          email: result.user.email,
          role: 'employee',
          permissions: ['view_dash','clinic','pos','online','inventory','lab'],
          status: 'active',
          createdAt: serverTimestamp(),
          authMethod: 'google'
        };
        await setDoc(doc(db, 'users', result.user.uid), userData);
      } else {
        userData = userDoc.data();
        if (userData.status === 'frozen') {
          await firebaseSignOut(auth);
          return { success: false, msg: 'هذا الحساب مجمد. تواصل مع الإدارة' };
        }
      }
      
      Auth.user = {
        uid: result.user.uid,
        email: result.user.email,
        name: userData.name,
        role: userData.role || 'employee',
        permissions: userData.permissions || [],
        fullData: userData
      };
      
      Auth._saveUser(Auth.user);
      return { success: true };
      
    } catch (error) {
      Auth._logError('googleLogin', error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        return { success: false, msg: 'تم إغلاق نافذة تسجيل الدخول' };
      }
      if (error.code === 'auth/popup-blocked') {
        return { success: false, msg: 'تم حظر النافذة المنبثقة. فعّل النوافذ المنبثقة' };
      }
      
      return { success: false, msg: 'فشل تسجيل الدخول عبر Google' };
    }
  },
  
  // ═══════════════════════════════════════════════════════
  //  🔑 PASSWORD RESET
  // ═══════════════════════════════════════════════════════
  
  sendPasswordReset: async (email) => {
    try {
      if (!email) {
        return { success: false, msg: 'البريد الإلكتروني مطلوب' };
      }
      
      await sendPasswordResetEmail(auth, email);
      return { 
        success: true, 
        msg: 'تم إرسال رابط استرجاع كلمة المرور إلى بريدك الإلكتروني' 
      };
      
    } catch (error) {
      Auth._logError('passwordReset', error);
      
      if (error.code === 'auth/user-not-found') {
        return { success: false, msg: 'البريد الإلكتروني غير موجود' };
      }
      if (error.code === 'auth/invalid-email') {
        return { success: false, msg: 'بريد إلكتروني غير صالح' };
      }
      
      return { success: false, msg: 'حدث خطأ في إرسال رابط الاسترجاع' };
    }
  },
  
  // ═══════════════════════════════════════════════════════
  //  ✅ CHECK & LOGOUT
  // ═══════════════════════════════════════════════════════
  
  check: () => {
    const userData = Auth._loadUser();
    if (userData) {
      Auth.user = userData;
      return true;
    }
    return false;
  },
  
  logout: async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      Auth._logError('logout', error);
    } finally {
      Auth._clearUser();
      Auth.user = null;
      window.location.reload();
    }
  }
};

// ✅ Auto Session Check (every hour)
setInterval(() => {
  if (Auth.user) {
    const timestamp = parseInt(localStorage.getItem('auth_timestamp') || '0');
    const hoursPassed = (Date.now() - timestamp) / (1000 * 60 * 60);
    
    if (hoursPassed > 24) {
      alert('انتهت صلاحية جلستك. سجّل دخول مرة أخرى');
      Auth.logout();
    }
  }
}, 3600000);
