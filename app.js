import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { Auth } from './auth.js'; 

const firebaseConfig = {
    apiKey: "AIzaSyB11C4GGgAyqeThs8a9cvDNN7frvAA1nqQ",
    authDomain: "delta-optics-system.firebaseapp.com",
    projectId: "delta-optics-system",
    storageBucket: "delta-optics-system.firebasestorage.app",
    messagingSenderId: "111176219224",
    appId: "1:111176219224:web:e0d8a5f26b84d57249a82d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ================== تفعيل وضع الأوفلاين ==================
enableIndexedDbPersistence(db).catch((err) => { console.warn("Offline DB Error:", err.code); });

// ================== إشعارات ذكية (Toast) ==================
const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });

window.allUnifiedRecords = []; window.todayInvoicesData = [];

// ================== واجهة المستخدم والتصدير ==================
window.toggleSidebar = () => { document.getElementById('main-sidebar').classList.toggle('active'); document.getElementById('sidebar-overlay').classList.toggle('active'); };
window.showView = (id) => { document.querySelectorAll('.view').forEach(v => v.style.display = 'none'); document.getElementById(id).style.display = 'block'; window.scrollTo({ top: 0, behavior: 'smooth' }); };

window.exportToExcel = (tableBodyId, fileName) => {
    let tbody = document.getElementById(tableBodyId);
    if(!tbody || tbody.rows.length === 0) return Toast.fire({ icon: 'warning', title: 'لا توجد بيانات' });
    let tempTable = document.createElement("table");
    let thead = tbody.closest('table').querySelector('thead').cloneNode(true);
    let clonedTbody = tbody.cloneNode(true);
    tempTable.appendChild(thead); tempTable.appendChild(clonedTbody);
    let wb = XLSX.utils.table_to_book(tempTable, {sheet: "البيانات"});
    XLSX.writeFile(wb, `${fileName}_${new Date().toLocaleDateString('en-GB')}.xlsx`);
    Toast.fire({ icon: 'success', title: 'تم التصدير' });
};

// ================== إدارة الحسابات واللوجن ==================
window.handleLogin = async () => {
    const res = await Auth.login(document.getElementById('auth-u').value, document.getElementById('auth-p').value);
    if (res.success) {
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('display-user').innerText = Auth.user.name;
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = Auth.user.role !== 'employee' ? 'flex' : 'none');
        startSync(); window.showView('dash'); Toast.fire({ icon: 'success', title: 'تم تسجيل الدخول' });
    } else { Swal.fire('مرفوض', res.msg, 'error'); }
};

document.addEventListener('DOMContentLoaded', () => { if (Auth.check()) { document.getElementById('login-modal').style.display = 'none'; document.getElementById('display-user').innerText = Auth.user.name; startSync(); window.showView('dash'); } });
window.handleLogout = () => { Auth.logout(); location.reload(); };

// ================== الحسابات والعمليات ==================
window.calcUnifiedTotal = () => {
    const subtotal = (parseFloat(document.getElementById('u-frame-price').value)||0) + (parseFloat(document.getElementById('u-lenses-price').value)||0);
    document.getElementById('u-subtotal').value = subtotal.toFixed(2);
    const total = subtotal - (subtotal * ((parseFloat(document.getElementById('u-discount').value)||0) / 100));
    document.getElementById('u-total').value = total.toFixed(2);
    const due = Math.max(0, total - (parseFloat(document.getElementById('u-paid').value)||0));
    document.getElementById('u-due').value = due.toFixed(2); document.getElementById('u-due-display').innerText = due.toFixed(2);
};

window.calcPosTotal = () => {
    const total = parseFloat(document.getElementById('pos-price').value)||0; document.getElementById('pos-total').value = total.toFixed(2);
    const due = Math.max(0, total - (parseFloat(document.getElementById('pos-paid').value)||0));
    document.getElementById('pos-due').value = due.toFixed(2); document.getElementById('pos-due-display').innerText = due.toFixed(2);
};
window.updatePosPrice = () => { const sel = document.getElementById('pos-product'); document.getElementById('pos-price').value = sel.options[sel.selectedIndex]?.dataset.price || 0; window.calcPosTotal(); };

window.saveUnifiedRecord = async () => {
    const name = document.getElementById('u-name').value.trim(); if (!name) return Toast.fire({icon: 'error', title: 'الاسم إجباري'});
    const invId = 'DLT-' + Math.floor(Math.random() * 90000 + 10000);
    try {
        await addDoc(collection(db, "invoices"), { invId, pName: name, total: parseFloat(document.getElementById('u-total').value)||0, paid: parseFloat(document.getElementById('u-paid').value)||0, due: parseFloat(document.getElementById('u-due').value)||0, time: serverTimestamp(), isUnified: true });
        Toast.fire({ icon: 'success', title: 'تم حفظ الملف' });
    } catch (e) { console.error(e); }
};

window.createInvoice = async () => {
    const sel = document.getElementById('pos-product'); if (!sel.value) return Toast.fire({icon: 'error', title: 'اختر منتج'});
    try {
        await addDoc(collection(db, "invoices"), { invId: 'POS-'+Math.floor(Math.random()*90000+10000), pName: document.getElementById('pos-patient').value||'زبون نقدي', total: parseFloat(document.getElementById('pos-total').value)||0, due: parseFloat(document.getElementById('pos-due').value)||0, time: serverTimestamp(), isUnified: false });
        await updateDoc(doc(db, "products", sel.value), { qty: Number(sel.options[sel.selectedIndex].dataset.qty) - 1 });
        Toast.fire({ icon: 'success', title: 'تم البيع' });
    } catch(e) { console.error(e); }
};

window.saveProduct = async () => {
    const name = document.getElementById('p-name').value, price = document.getElementById('p-price').value, qty = document.getElementById('p-qty').value;
    if (!name || !price) return Toast.fire({icon: 'warning', title: 'أكمل البيانات'});
    await addDoc(collection(db, "products"), { name, price: Number(price), qty: Number(qty), time: serverTimestamp() });
    Toast.fire({ icon: 'success', title: 'تم إضافة المنتج' });
};

// ================== المزامنة والرسوم البيانية ==================
let salesChartInstance = null;
function updateChart(dataPoints, labels) {
    const ctx = document.getElementById('salesChart'); if(!ctx) return;
    if (salesChartInstance) salesChartInstance.destroy();
    salesChartInstance = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: 'المبيعات (JOD)', data: dataPoints, backgroundColor: '#2563eb', borderRadius: 8 }] }, options: { responsive: true } });
}

function startSync() {
    onSnapshot(query(collection(db, "products"), orderBy("time", "desc")), (s) => {
        let invHtml = "", posProdHtml = "<option value=''>-- اختر المنتج --</option>", lowStock = 0;
        s.forEach(d => { const p = d.data(); const isLow = p.qty < 5; if(isLow) lowStock++;
            invHtml += `<tr><td>${p.name}</td><td class="en-num ${isLow?'stock-alert':''}">${p.qty} ${isLow?'⚠️':''}</td><td class="en-num">${p.price}</td></tr>`;
            if (p.qty > 0) posProdHtml += `<option value="${d.id}" data-price="${p.price}" data-qty="${p.qty}">${p.name}</option>`;
        });
        document.getElementById('tb-inv').innerHTML = invHtml; document.getElementById('pos-product').innerHTML = posProdHtml;
        const bell = document.getElementById('stock-bell'); if(bell) { bell.style.color = lowStock > 0 ? 'var(--danger)' : 'var(--text-muted)'; bell.classList.toggle('fa-shake', lowStock > 0); }
    });

    onSnapshot(query(collection(db, "invoices"), orderBy("time", "desc")), (s) => {
        let tbUnified = "", tbPos = "", totalSales = 0, salesByDate = {}; window.allUnifiedRecords = [];
        s.forEach(d => { 
            const i = d.data(); const dateStr = i.time ? i.time.toDate().toLocaleDateString('en-GB') : 'اليوم';
            if(!salesByDate[dateStr]) salesByDate[dateStr] = 0; salesByDate[dateStr] += Number(i.total); totalSales += Number(i.total);
            if (i.isUnified) { tbUnified += `<tr><td style="font-weight:bold;">${i.pName}</td><td class="en-num">${dateStr}</td><td class="en-num" style="font-weight:bold;">${Number(i.total).toFixed(2)}</td></tr>`; document.getElementById('patients-list').innerHTML += `<option value="${i.pName}">`; }
            else { tbPos += `<tr><td class="en-num">${i.invId}</td><td>${i.pName}</td><td class="en-num">${Number(i.total).toFixed(2)}</td><td class="en-num" style="color:var(--danger);">${Number(i.due).toFixed(2)}</td></tr>`; }
        });
        document.getElementById('tb-unified-rx').innerHTML = tbUnified; document.getElementById('tb-invc').innerHTML = tbPos; document.getElementById('kpi-sales').innerText = totalSales.toFixed(2);
        const labels = Object.keys(salesByDate).slice(0, 7).reverse(); const dataPoints = Object.values(salesByDate).slice(0, 7).reverse(); updateChart(dataPoints, labels);
    });
}
