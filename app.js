// ================== Firebase Setup ==================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, onSnapshot, query, orderBy,
    serverTimestamp, doc, setDoc, deleteDoc, updateDoc, limit
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { Auth } from './auth.js';

const firebaseConfig = {
    apiKey: "YOUR_KEY_HERE", // ⚠️ حطه من env
    authDomain: "delta-optics-system.firebaseapp.com",
    projectId: "delta-optics-system"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ================== Global State ==================
window.state = {
    invoices: [],
    expenses: [],
    staff: [],
    tests: []
};

// ================== Utils ==================
const Utils = {
    sanitize: (str) => {
        if (!str) return '';
        return str.replace(/[<>]/g, '');
    },

    validateNumber: (n) => {
        return !isNaN(n) && n >= 0;
    },

    formatCurrency: (n) => {
        return Number(n || 0).toFixed(2);
    },

    todayStr: () => new Date().toDateString()
};

// ================== Logger ==================
const Logger = {
    async audit(action) {
        try {
            if (!Auth.user) return;
            await addDoc(collection(db, "audit_logs"), {
                user: Auth.user.name,
                action,
                time: serverTimestamp()
            });
        } catch (e) {
            console.error("Audit error:", e);
        }
    },

    error(e, context = "") {
        console.error("ERROR:", context, e);
        Swal.fire('خطأ', 'صار خطأ بالنظام', 'error');
    }
};

// ================== Auth ==================
window.handleLogin = async () => {
    try {
        const u = Utils.sanitize(document.getElementById('auth-u').value);
        const p = document.getElementById('auth-p').value;

        if (!u || !p) return Swal.fire('تنبيه', 'أدخل البيانات', 'warning');

        const res = await Auth.login(u, p);

        if (!res.success) {
            return Swal.fire('مرفوض', res.msg, 'error');
        }

        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('display-user').innerText = Auth.user.name;

        applyRoles(Auth.user.role);
        Logger.audit("تسجيل دخول");

        startSync();
        showView('dash');

    } catch (e) {
        Logger.error(e, "Login");
    }
};

window.handleLogout = () => {
    Logger.audit("تسجيل خروج");
    Auth.logout();
};

// ================== Roles ==================
function applyRoles(role) {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');

    if (['manager', 'developer', 'superadmin'].includes(role)) {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
    }

    document.getElementById('display-role').innerText =
        role === 'employee' ? 'موظف' : 'مدير';
}

// ================== Expenses ==================
window.saveExpense = async () => {
    try {
        const amount = parseFloat(document.getElementById('exp-amount').value);
        const desc = Utils.sanitize(document.getElementById('exp-desc').value);

        if (!Utils.validateNumber(amount) || !desc) {
            return Swal.fire('خطأ', 'بيانات غير صحيحة', 'error');
        }

        await addDoc(collection(db, "expenses"), {
            amount,
            desc,
            user: Auth.user.name,
            time: serverTimestamp()
        });

        Logger.audit(`مصروف: ${desc}`);
        Swal.fire('تم', 'تم الحفظ', 'success');

    } catch (e) {
        Logger.error(e, "Expense");
    }
};

// ================== POS ==================
window.createInvoice = async () => {
    try {
        const pName = Utils.sanitize(document.getElementById('pos-patient').value);
        const total = parseFloat(document.getElementById('pos-total').value) || 0;
        const paid = parseFloat(document.getElementById('pos-paid').value) || 0;

        if (!pName || total <= 0) {
            return Swal.fire('خطأ', 'بيانات ناقصة', 'error');
        }

        const invId = "POS-" + Date.now();

        await addDoc(collection(db, "invoices"), {
            invId,
            pName,
            total,
            paid,
            due: total - paid,
            time: serverTimestamp(),
            doctor: Auth.user.name
        });

        Logger.audit(`فاتورة POS: ${invId}`);
        Swal.fire('نجاح', 'تم البيع', 'success');

    } catch (e) {
        Logger.error(e, "POS");
    }
};

// ================== Soft Delete ==================
window.softDelete = async (col, id, data) => {
    try {
        await addDoc(collection(db, "recycle_bin"), {
            col,
            data,
            deletedAt: serverTimestamp(),
            user: Auth.user.name
        });

        await deleteDoc(doc(db, col, id));

        Logger.audit(`حذف: ${col}`);
    } catch (e) {
        Logger.error(e, "Delete");
    }
};

// ================== Sync ==================
function startSync() {

    // Invoices
    onSnapshot(query(collection(db, "invoices"), orderBy("time", "desc")), snap => {
        window.state.invoices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderInvoices();
    });

    // Expenses
    onSnapshot(query(collection(db, "expenses"), orderBy("time", "desc")), snap => {
        window.state.expenses = snap.docs.map(d => d.data());
    });

    // Users
    onSnapshot(collection(db, "users"), snap => {
        window.state.staff = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    });
}

// ================== UI ==================
window.showView = (id) => {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById(id).style.display = 'block';
};

function renderInvoices() {
    const tb = document.getElementById('tb-invc');
    if (!tb) return;

    tb.innerHTML = window.state.invoices.map(i => `
        <tr>
            <td>${i.invId}</td>
            <td>${i.pName}</td>
            <td>${Utils.formatCurrency(i.total)}</td>
        </tr>
    `).join('');
}

// ================== Init ==================
document.addEventListener('DOMContentLoaded', () => {
    if (Auth.check()) {
        document.getElementById('login-modal').style.display = 'none';
        startSync();
        showView('dash');
    }
});
