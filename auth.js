import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// تصدير للـ app.js
export { app, auth, db, googleProvider };

export const Auth = {
  user: null,
  
  // ─── تسجيل دخول بـ Email و Password
  login: async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      
      if (!userDoc.exists()) {
        return { success: false, msg: 'حساب غير موجود في النظام' };
      }
      
      const userData = userDoc.data();
      if (userData.status === 'frozen') {
        return { success: false, msg: 'هذا الحساب مجمد. تواصل مع الإدارة' };
      }
      
      Auth.user = {
        uid: result.user.uid,
        email: email,
        name: userData.name,
        role: userData.role || 'employee',
        permissions: userData.permissions || [],
        fullData: userData
      };
      
      localStorage.setItem('auth_user', JSON.stringify(Auth.user));
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, msg: 'بريد أو كلمة مرور خاطئة' };
    }
  },
  
  // ─── تسجيل دخول بـ Google
  loginWithGoogle: async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      
      let userData;
      if (!userDoc.exists()) {
        // إنشاء حساب جديد تلقائياً للمستخدمين الجدد من Google
        userData = {
          name: result.user.displayName || 'Google User',
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
      
      localStorage.setItem('auth_user', JSON.stringify(Auth.user));
      return { success: true };
    } catch (error) {
      console.error('Google login error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        return { success: false, msg: 'تم إغلاق نافذة تسجيل الدخول' };
      }
      return { success: false, msg: 'فشل تسجيل الدخول عبر Google' };
    }
  },
  
  // ─── إرسال رسالة استرجاع كلمة المرور
  sendPasswordReset: async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true, msg: 'تم إرسال رابط استرجاع كلمة المرور إلى بريدك الإلكتروني' };
    } catch (error) {
      console.error('Password reset error:', error);
      if (error.code === 'auth/user-not-found') {
        return { success: false, msg: 'البريد الإلكتروني غير موجود' };
      }
      return { success: false, msg: 'حدث خطأ في إرسال رابط الاسترجاع' };
    }
  },
  
  // ─── التحقق من تسجيل الدخول
  check: () => {
    const stored = localStorage.getItem('auth_user');
    if (stored) {
      try {
        Auth.user = JSON.parse(stored);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  },
  
  // ─── تسجيل الخروج
  logout: () => {
    localStorage.removeItem('auth_user');
    Auth.user = null;
    firebaseSignOut(auth).catch(e => console.error('Logout error:', e));
    window.location.reload();
  }
};
