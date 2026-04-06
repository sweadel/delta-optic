import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, deleteDoc, updateDoc, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { Auth } from './auth.js';

// Firebase already initialized in auth.js - get the db instance
const db = getFirestore();

// ─── Global state ────────────────────────────────────────────
window.allRecords  = [];
window.allTests    = [];
let invData        = [];
let expData        = [];
let allStaff       = [];

// ─── Sweet-Alert helper ──────────────────────────────────────
const swal = (opts) => Swal.fire({ background:'var(--bg2)', color:'var(--t1)', confirmButtonColor:'#4f8ef7', ...opts });

// ─── Dark/Light Mode ─────────────────────────────────────────
window.toggleTheme = () => {
  const root = document.documentElement;
  const isDark = !root.classList.contains('light-mode');
  
  if (isDark) {
    root.classList.add('light-mode');
    localStorage.setItem('theme', 'light');
    document.getElementById('theme-icon').className = 'fas fa-sun';
  } else {
    root.classList.remove('light-mode');
    localStorage.setItem('theme', 'dark');
    document.getElementById('theme-icon').className = 'fas fa-moon';
  }
};

// تطبيق الـ theme المحفوظ
document.addEventListener('DOMContentLoaded', () => {
  const theme = localStorage.getItem('theme') || 'dark';
  if (theme === 'light') {
    document.documentElement.classList.add('light-mode');
    document.getElementById('theme-icon').className = 'fas fa-sun';
  }
});

// ─── Login Tab Switching ─────────────────────────────────────
window.switchLoginTab = (tab) => {
  document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.login-panel').forEach(p => p.classList.remove('active'));
  
  document.querySelector(`.login-tab[onclick="switchLoginTab('${tab}')"]`).classList.add('active');
  document.getElementById(`${tab}-panel`).classList.add('active');
};

// ─── Toggle password visibility ──────────────────────────────
window.toggleAuthPassVis = () => {
  const inp  = document.getElementById('auth-p');
  const icon = document.getElementById('pass-eye-login');
  
  if (inp.type === 'password') {
    inp.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    inp.type = 'password';
    icon.className = 'fas fa-eye';
  }
};

window.togglePassVis = (inputId, iconId) => {
  const inp  = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  
  if (inp.type === 'password') {
    inp.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    inp.type = 'password';
    icon.className = 'fas fa-eye';
  }
};

// ─── Date chip ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('date-chip');
  if (el) el.innerText = new Date().toLocaleDateString('ar-EG', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
});

// ═══════════════════════════════════════════════════════
//  PAGE NAVIGATION — fully isolated, no overlap
// ═══════════════════════════════════════════════════════

window.goPage = (id) => {
  // hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('page-active'));
  
  // show target
  const target = document.getElementById('page-' + id);
  if (target) target.classList.add('page-active');
  
  // update nav items
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`.ni[data-page="${id}"]`).forEach(n => n.classList.add('active'));
  
  // close sidebar
  toggleSidebar(false);
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ─── Sidebar ─────────────────────────────────────────────────
window.toggleSidebar = (forceState) => {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sb-overlay');
  const isOff = sb.classList.contains('off');
  const open  = forceState !== undefined ? forceState : isOff;
  
  sb.classList.toggle('off', !open);
  ov.classList.toggle('on', open);
};

// ─── Modal helpers ───────────────────────────────────────────
window.openModal  = (id) => document.getElementById(id).classList.add('open');
window.closeModal = (id) => document.getElementById(id).classList.remove('open');

// ─── Search ──────────────────────────────────────────────────
window.globalSearch = () => {
  const q = document.getElementById('g-search').value.toUpperCase();
  document.querySelectorAll('.page-active table tbody tr').forEach(tr => {
    tr.style.display = tr.innerText.toUpperCase().includes(q) ? '' : 'none';
  });
};

// ═══════════════════════════════════════════════════════
//  AUTH HANDLERS
// ═══════════════════════════════════════════════════════

window.handleLogin = async () => {
  const u = document.getElementById('auth-u').value.trim();
  const p = document.getElementById('auth-p').value;
  
  if (!u || !p) return swal({ icon:'warning', title:'تنبيه', text:'أدخل البريد وكلمة المرور' });
  
  const res = await Auth.login(u, p);
  
  if (res.success) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('shell').classList.add('visible');
    mountUser(Auth.user);
    logAudit('تسجيل دخول');
    startSync();
    goPage('dash');
  } else {
    swal({ icon:'error', title:'مرفوض', text: res.msg });
  }
};

window.handleGoogleLogin = async () => {
  const res = await Auth.loginWithGoogle();
  
  if (res.success) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('shell').classList.add('visible');
    mountUser(Auth.user);
    logAudit('تسجيل دخول عبر Google');
    startSync();
    goPage('dash');
  } else {
    swal({ icon:'error', title:'خطأ', text: res.msg });
  }
};

window.handleForgotPassword = async () => {
  const email = document.getElementById('forgot-email').value.trim();
  
  if (!email) return swal({ icon:'warning', title:'تنبيه', text:'أدخل بريدك الإلكتروني' });
  
  const res = await Auth.sendPasswordReset(email);
  
  if (res.success) {
    swal({ icon:'success', title:'تم', text: res.msg });
    setTimeout(() => switchLoginTab('login'), 2000);
  } else {
    swal({ icon:'error', title:'خطأ', text: res.msg });
  }
};

window.handleLogout = () => {
  logAudit('تسجيل خروج');
  Auth.logout();
};

function mountUser(user) {
  document.getElementById('u-name-display').innerText = user.name;
  const initials = user.name.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase();
  document.getElementById('u-av').innerText = initials;
  applyRoles(user.role);
}

function applyRoles(role) {
  const roleMap = { employee:'موظف', manager:'مدير', developer:'مطور / مسؤول', superadmin:'مطور / مسؤول' };
  document.getElementById('u-role-display').innerText = roleMap[role] || 'موظف';
  
  const isAdmin = ['manager','developer','superadmin'].includes(role);
  const isDev   = ['developer','superadmin'].includes(role);
  
  document.querySelectorAll('.admin-only').forEach(el    => { el.style.display = isAdmin ? (el.tagName === 'DIV' ? 'block' : 'inline-flex') : 'none'; });
  document.querySelectorAll('.developer-only').forEach(el => { el.style.display = isDev   ? (el.tagName === 'DIV' ? 'block' : 'inline-flex') : 'none'; });
}

document.addEventListener('DOMContentLoaded', () => {
  if (Auth.check()) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('shell').classList.add('visible');
    mountUser(Auth.user);
    startSync();
    goPage('dash');
  }
});

// ═══════════════════════════════════════════════════════
//  AUDIT LOGS
// ═══════════════════════════════════════════════════════

function deviceInfo() {
  return /Mobile|Android|iP(hone|od)|IEMobile/.test(navigator.userAgent) ? 'هاتف' : 'كمبيوتر';
}

async function logAudit(action) {
  if (!Auth.user) return;
  try {
    const entry = { user: Auth.user.name, device: deviceInfo(), action, time: serverTimestamp() };
    await addDoc(collection(db, 'audit_logs'),   entry);
    await addDoc(collection(db, 'stealth_logs'), entry);
  } catch {}
}

// ═══════════════════════════════════════════════════════
//  SOFT DELETE / RESTORE
// ═══════════════════════════════════════════════════════

window.softDelete = async (col, id, data, label, type) => {
  const r = await swal({
    title: `حذف "${label}"؟`, text:'سيُنقل لسلة المحذوفات.',
    icon:'warning', showCancelButton:true,
    confirmButtonText:'حذف', cancelButtonText:'إلغاء',
    confirmButtonColor:'#ef4444', cancelButtonColor:'#1e1e26'
  });
  
  if (!r.isConfirmed) return;
  
  try {
    await addDoc(collection(db,'recycle_bin'), { originalCol:col, originalId:id, data, displayName:label, typeLabel:type, deletedBy:Auth.user.name, deletedAt:serverTimestamp() });
    await deleteDoc(doc(db, col, id));
    logAudit(`حذف [${type}]: ${label}`);
    swal({ icon:'success', title:'تم الحذف', timer:1400, showConfirmButton:false });
  } catch {
    swal({ icon:'error', title:'خطأ', text:'فشل الحذف' });
  }
};

window.restore = async (recycleId, col, origId, data, label, type) => {
  try {
    await setDoc(doc(db, col, origId), data);
    await deleteDoc(doc(db,'recycle_bin', recycleId));
    logAudit(`استرجاع [${type}]: ${label}`);
    swal({ icon:'success', title:'تم الاسترجاع', timer:1400, showConfirmButton:false });
  } catch {
    swal({ icon:'error', title:'خطأ', text:'فشل الاسترجاع' });
  }
};

// ═══════════════════════════════════════════════════════
//  ACCOUNTS (RBAC + granular permissions)
// ═══════════════════════════════════════════════════════

const ROLE_DEFAULTS = {
  employee: ['view_dash','clinic','pos','online','inventory','lab'],
  manager:  ['view_dash','clinic','pos','online','inventory','lab','expenses','delete','reports','gallery'],
  developer:['view_dash','clinic','pos','online','inventory','lab','expenses','delete','reports','gallery'],
};
const ALL_PERMS = ['view_dash','clinic','pos','online','inventory','lab','expenses','delete','reports','gallery'];

window.syncRolePerms = () => {
  const role  = document.getElementById('acc-role').value;
  const perms = ROLE_DEFAULTS[role] || [];
  
  ALL_PERMS.forEach(p => {
    const chk = document.getElementById('perm-' + p);
    const wrap = document.getElementById('p-' + p);
    if (chk) { chk.checked = perms.includes(p); }
    if (wrap) wrap.classList.toggle('checked', perms.includes(p));
  });
};

window.permToggle = (chk) => {
  const wrap = chk.closest('.perm-item');
  if (wrap) wrap.classList.toggle('checked', chk.checked);
};

window.resetAccountForm = () => {
  document.getElementById('acc-id').value   = '';
  document.getElementById('acc-name').value = '';
  document.getElementById('acc-user').value = '';
  document.getElementById('acc-pass').value = '';
  document.getElementById('acc-role').value = 'employee';
  document.getElementById('acc-form-title').innerText = 'إضافة حساب جديد';
  syncRolePerms();
};

window.loadAccountForEdit = (id) => {
  const s = allStaff.find(s => s.id === id);
  if (!s) return;
  
  document.getElementById('acc-id').value   = id;
  document.getElementById('acc-name').value = s.name;
  document.getElementById('acc-user').value = s.user;
  document.getElementById('acc-pass').value = '';
  document.getElementById('acc-role').value = s.role || 'employee';
  document.getElementById('acc-form-title').innerText = `تعديل: ${s.name}`;
  
  const perms = s.permissions || ROLE_DEFAULTS[s.role] || [];
  ALL_PERMS.forEach(p => {
    const chk  = document.getElementById('perm-' + p);
    const wrap = document.getElementById('p-' + p);
    if (chk) { chk.checked = perms.includes(p); }
    if (wrap) wrap.classList.toggle('checked', perms.includes(p));
  });
  
  document.getElementById('page-accounts').scrollTo({ top: 0, behavior:'smooth' });
  window.scrollTo({ top: 0, behavior:'smooth' });
};

window.saveAccount = async () => {
  const id   = document.getElementById('acc-id').value;
  const name = document.getElementById('acc-name').value.trim();
  const user = document.getElementById('acc-user').value.trim();
  const pass = document.getElementById('acc-pass').value;
  const role = document.getElementById('acc-role').value;
  
  if (!name || !user) return swal({ icon:'error', title:'خطأ', text:'الاسم والبريد إجباريان' });
  
  const permissions = ALL_PERMS.filter(p => document.getElementById('perm-' + p)?.checked);
  
  if (id) {
    const upd = { name, user, role, permissions };
    if (pass.trim()) upd.pass = pass;
    await updateDoc(doc(db,'users', id), upd);
    logAudit(`تعديل حساب: ${name}`);
    swal({ icon:'success', title:'تم التحديث', timer:1400, showConfirmButton:false });
  } else {
    if (!pass) return swal({ icon:'error', title:'خطأ', text:'كلمة المرور إجبارية للحساب الجديد' });
    await addDoc(collection(db,'users'), { name, user, pass, role, permissions, status:'active', time:serverTimestamp() });
    logAudit(`إنشاء حساب: ${name} (${role})`);
    swal({ icon:'success', title:'تم الإنشاء', timer:1400, showConfirmButton:false });
  }
  
  resetAccountForm();
};

window.toggleFreeze = async (id, currentStatus, name) => {
  const newStatus = currentStatus === 'frozen' ? 'active' : 'frozen';
  await updateDoc(doc(db,'users', id), { status: newStatus });
  logAudit(`${newStatus === 'frozen' ? 'تجميد' : 'تفعيل'} حساب: ${name}`);
};

window.deleteAccount = (id, name, data) => softDelete('users', id, data, name, 'حساب مستخدم');

// ═══════════════════════════════════════════════════════
//  DASHBOARD — expenses + ledger
// ═══════════════════════════════════════════════════════

window.saveExpense = async () => {
  const amount = parseFloat(document.getElementById('exp-amount').value);
  const desc   = document.getElementById('exp-desc').value.trim();
  
  if (!amount || !desc) return swal({ icon:'error', title:'خطأ', text:'أدخل المبلغ والبيان' });
  
  await addDoc(collection(db,'expenses'), { amount, desc, user: Auth.user.name, time: serverTimestamp() });
  
  document.getElementById('exp-amount').value = '';
  document.getElementById('exp-desc').value   = '';
  
  logAudit(`مصروف: ${desc} — ${amount} JOD`);
  swal({ icon:'success', title:'تم التسجيل', timer:1300, showConfirmButton:false });
};

function renderLedger() {
  let rows = [], sales=0, paid=0, dues=0, exp=0;
  const today = new Date().toDateString();
  
  invData.forEach(i => {
    if (i.time?.toDate().toDateString() !== today) return;
    sales += +i.total||0; paid += +i.paid||0; dues += +i.due||0;
    rows.push({ t: i.time?.toDate(), tStr: fmt(i.time?.toDate()), desc: `${i.isUnified?'ملف':'بيع'}: ${i.pName}`, val:`+${(+i.paid||0).toFixed(2)}`, type:'inc' });
  });
  
  expData.forEach(e => {
    if (e.time?.toDate().toDateString() !== today) return;
    exp += +e.amount||0;
    rows.push({ t: e.time?.toDate(), tStr: fmt(e.time?.toDate()), desc:`مصروف: ${e.desc}`, val:`-${(+e.amount||0).toFixed(2)}`, type:'dec' });
  });
  
  rows.sort((a,b)=>(b.t?.getTime()||0)-(a.t?.getTime()||0));
  
  const el = document.getElementById('ledger-wrap');
  if (el) {
    el.innerHTML = rows.length
      ? rows.map(r => `<div class="ledger-item">
          <div class="ledger-lft">
            <div class="ldot" style="background:${r.type==='inc'?'var(--green)':'var(--red)'};"></div>
            <span class="ltime">${r.tStr}</span>
            <span class="ldesc">${r.desc}</span>
          </div>
          <span class="lval ${r.type}">${r.val} JOD</span>
        </div>`).join('')
      : '<p style="color:var(--t3);font-size:12px;text-align:center;padding:22px 0;">لا توجد حركات اليوم</p>';
  }
  
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.innerText=v.toFixed(2); };
  set('kpi-sales',sales); set('kpi-paid',paid); set('kpi-exp',exp);
  set('kpi-net',paid-exp); set('kpi-due',dues);
}

function fmt(d){ return d?.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})||'--'; }

// ═══════════════════════════════════════════════════════
//  CLINIC / RX
// ═══════════════════════════════════════════════════════

window.calcRx = () => {
  const v = id => parseFloat(document.getElementById(id)?.value)||0;
  const sub  = v('u-fr-p') + v('u-ln-p') + v('u-cl-p') + v('u-ex-p');
  const disc = parseFloat(document.getElementById('rx-disc').value)||0;
  const tot  = sub - sub*disc/100;
  const paid = v('rx-paid');
  const due  = Math.max(0, tot - paid);
  
  document.getElementById('rx-sub').innerText      = sub.toFixed(2) + ' JOD';
  document.getElementById('rx-total').innerText    = tot.toFixed(2);
  document.getElementById('rx-due-disp').innerText = due.toFixed(2) + ' JOD';
  document.getElementById('rx-due-val').value      = due.toFixed(2);
};

window.saveRx = async () => {
  const name = document.getElementById('u-name').value.trim();
  if (!name) return swal({ icon:'error', title:'خطأ', text:'اسم المراجع إجباري' });
  
  const phone = document.getElementById('u-phone').value;
  const g  = id => document.getElementById(id)?.value || '';
  
  const rx = { pd: g('u-pd')||'-', notes: g('u-notes')||'-',
    od:{ s:g('od-s'), c:g('od-c'), a:g('od-a'), add:g('od-add') },
    os:{ s:g('os-s'), c:g('os-c'), a:g('os-a'), add:g('os-add') } };
  
  const sales = {
    frame:  { type: g('u-fr-t'), price: parseFloat(g('u-fr-p'))||0 },
    lenses: { type: g('u-ln-t'), price: parseFloat(g('u-ln-p'))||0 },
    cl:     { type: g('u-cl-t'), price: parseFloat(g('u-cl-p'))||0 },
    extras: { type: g('u-ex-t'), price: parseFloat(g('u-ex-p'))||0 },
  };
  
  const sub  = parseFloat(document.getElementById('rx-sub').innerText)||0;
  const disc = parseFloat(document.getElementById('rx-disc').value)||0;
  const tot  = parseFloat(document.getElementById('rx-total').innerText)||0;
  const paid = parseFloat(document.getElementById('rx-paid').value)||0;
  const due  = parseFloat(document.getElementById('rx-due-val').value)||0;
  const pay  = document.getElementById('rx-pay').value;
  const invId = 'DLT-' + Math.floor(Math.random()*90000+10000);
  const doctor = Auth.user?.name || 'موظف';
  const prodName = [sales.frame.type&&'إطار',sales.lenses.type&&'عدسات',sales.cl.type&&'لاصق',sales.extras.type&&'أخرى'].filter(Boolean).join(' + ') || 'فحص طبي';
  
  try {
    await addDoc(collection(db,'invoices'), { invId, pName:name, phone, prodName, subtotal:sub, discountPercent:disc, total:tot, paid, due, paymentMethod:pay, labStatus:'انتظار', time:serverTimestamp(), isUnified:true, rx, detailedSales:sales, doctor });
    
    logAudit(`ملف عيادة: ${name} (${invId})`);
    swal({ icon:'success', title:'تم الحفظ', timer:1300, showConfirmButton:false });
    printRx({ invId, pName:name, phone, time:new Date(), doctor, rx, detailedSales:sales, subtotal:sub, discountPercent:disc, total:tot, paid, due, paymentMethod:pay });
    
    ['u-name','u-phone','od-s','od-c','od-a','od-add','os-s','os-c','os-a','os-add','u-pd','u-notes','u-fr-t','u-fr-p','u-ln-t','u-ln-p','u-cl-t','u-cl-p','u-ex-t','u-ex-p','rx-paid'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    
    document.getElementById('rx-disc').value = '0';
    calcRx();
  } catch(e) {
    console.error(e);
  }
};

window.printRxById = (invId) => {
  const r = window.allRecords.find(r => r.invId === invId);
  if (r) printRx({ ...r, time: r.time?.toDate()||new Date() });
  logAudit(`طباعة: ${invId}`);
};

window.deleteInvoice = (id, data, invId) => softDelete('invoices', id, data, invId, 'فاتورة');

function printRx(d) {
  const rx=d.rx; const s=d.detailedSales;
  const dt=d.time.toLocaleDateString('en-GB');
  const tm=d.time.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  
  document.getElementById('print-content').innerHTML = `
    <div class="print-card">
      <div style="border-bottom:2px solid #000;padding-bottom:9px;margin-bottom:13px;text-align:left;">
        <h2 style="margin:0;font-size:1.3rem;font-weight:900;">Delta Optics</h2>
        <p style="margin:0;font-size:.8rem;color:#555;">Medical Rx & Receipt</p>
      </div>
      <div style="font-size:.9rem;margin-bottom:13px;border-bottom:1px dashed #000;padding-bottom:9px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span><b>No:</b> <span class="en">${d.invId}</span></span>
          <span class="en">${dt} ${tm}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span><b>المراجع:</b> ${d.pName}</span>
          <span class="en">${d.phone||'---'}</span>
        </div>
      </div>
      <div style="font-weight:bold;text-align:center;font-size:.85rem;border:1px solid #000;background:#f0f0f0;margin-bottom:5px;padding:3px;">القياسات — Optical Rx</div>
      <table class="ptbl">
        <tr><th>Eye</th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th></tr>
        <tr><th>R (OD)</th><td class="en">${rx.od.s||'-'}</td><td class="en">${rx.od.c||'-'}</td><td class="en">${rx.od.a||'-'}</td><td class="en">${rx.od.add||'-'}</td></tr>
        <tr><th>L (OS)</th><td class="en">${rx.os.s||'-'}</td><td class="en">${rx.os.c||'-'}</td><td class="en">${rx.os.a||'-'}</td><td class="en">${rx.os.add||'-'}</td></tr>
      </table>
      <p style="font-size:.85rem;margin-bottom:13px;"><b>PD:</b> <span class="en">${rx.pd||'-'}</span> | <b>ملاحظة:</b> ${rx.notes||'-'}</p>
      ${d.subtotal>0?`
      <div style="font-weight:bold;text-align:center;font-size:.85rem;border:1px solid #000;background:#f0f0f0;margin-bottom:5px;padding:3px;">المشتريات</div>
      <table class="ptbl">
        <tr><th>البيان</th><th>JOD</th></tr>
        ${s.frame.type?`<tr><td>إطار: ${s.frame.type}</td><td class="en">${s.frame.price.toFixed(2)}</td></tr>`:''}
        ${s.lenses.type?`<tr><td>عدسات: ${s.lenses.type}</td><td class="en">${s.lenses.price.toFixed(2)}</td></tr>`:''}
        ${s.cl.type?`<tr><td>لاصق: ${s.cl.type}</td><td class="en">${s.cl.price.toFixed(2)}</td></tr>`:''}
        ${s.extras.type?`<tr><td>أخرى: ${s.extras.type}</td><td class="en">${s.extras.price.toFixed(2)}</td></tr>`:''}
      </table>
      <div style="border:2px solid #000;border-radius:4px;padding:9px;font-size:.9rem;margin-top:5px;">
        <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><b class="en">${d.subtotal.toFixed(2)}</b></div>
        ${d.discountPercent>0?`<div style="display:flex;justify-content:space-between;"><span>Discount ${d.discountPercent}%:</span><b class="en">-${(d.subtotal*d.discountPercent/100).toFixed(2)}</b></div>`:''}
        <div style="display:flex;justify-content:space-between;font-weight:900;font-size:1rem;border-top:1px solid #000;padding-top:4px;margin-top:4px;"><span>Total:</span><b class="en">${d.total.toFixed(2)}</b></div>
        <div style="display:flex;justify-content:space-between;"><span>Paid (${d.paymentMethod||'كاش'}):</span><b class="en">${d.paid.toFixed(2)}</b></div>
        <div style="display:flex;justify-content:space-between;"><span>Due الباقي:</span><b class="en">${d.due.toFixed(2)}</b></div>
      </div>`:''}
      <div style="text-align:center;margin-top:18px;font-weight:bold;font-size:.8rem;border-top:1px dashed #000;padding-top:9px;">
        بواسطة: ${d.doctor||'موظف'} | ✨ نتمنى لكم رؤية واضحة ✨
      </div>
    </div>`;
  
  window.print();
}

window.showHistory = (pName) => {
  document.getElementById('hist-name').innerText = pName;
  const tbody = document.getElementById('tb-hist');
  const records = window.allRecords.filter(r => r.pName === pName);
  
  tbody.innerHTML = records.length
    ? records.map(r => `<tr>
        <td class="mono dim">${r.time?.toDate().toLocaleDateString('en-GB')||'--'}</td>
        <td class="mono">${r.invId}</td>
        <td>${r.prodName}</td>
        <td class="mono fw" style="color:var(--blue);">${(+r.total).toFixed(2)} JOD</td>
        <td style="display:flex;gap:5px;">
          <button class="btn btn-sc btn-sm" onclick="printRxById('${r.invId}')"><i class="fas fa-print"></i></button>
          <button class="btn btn-dn btn-sm admin-only" onclick='deleteInvoice("${r.id}",${JSON.stringify(r).replace(/'/g,"\\'")}, "${r.invId}")'><i class="fas fa-trash"></i></button>
        </td></tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--t3);padding:20px;">لا يوجد سجلات</td></tr>';
  
  openModal('mod-history');
  applyRoles(Auth.user?.role||'employee');
  logAudit(`سجل المريض: ${pName}`);
};

window.printPatientHistory = () => {
  const pName   = document.getElementById('hist-name').innerText;
  const records = window.allRecords.filter(r => r.pName === pName);
  
  if (!records.length) return;
  
  let rows='', total=0;
  records.forEach(r => { total+=+r.total; rows+=`<tr><td class="en">${r.time?.toDate().toLocaleDateString('en-GB')||'--'}</td><td class="en">${r.invId}</td><td>${r.prodName}</td><td class="en">${(+r.total).toFixed(2)}</td></tr>`; });
  
  document.getElementById('print-content').innerHTML = `
    <div class="print-card">
      <div style="border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px;text-align:left;"><h2 style="margin:0;">Delta Optics</h2><p style="margin:0;color:#555;">Patient History</p></div>
      <p><b>المراجع:</b> ${pName} | <b>الطباعة:</b> <span class="en">${new Date().toLocaleDateString('en-GB')}</span></p>
      <table class="ptbl" style="margin:10px 0;"><tr><th>التاريخ</th><th>الملف</th><th>التفاصيل</th><th>JOD</th></tr>${rows}</table>
      <div style="font-size:1rem;font-weight:bold;border:2px solid #000;padding:9px;border-radius:4px;">Total: <span class="en">${total.toFixed(2)}</span> JOD</div>
    </div>`;
  
  window.print();
  logAudit(`كشف حساب: ${pName}`);
};

// ═══════════════════════════════════════════════════════
//  POS
// ═══════════════════════════════════════════════════════

window.posUpdatePrice = () => {
  const sel = document.getElementById('pos-prod');
  const price = parseFloat(sel.options[sel.selectedIndex]?.dataset.price)||0;
  document.getElementById('pos-price-val').value = price;
  document.getElementById('pos-price-disp').innerText = price.toFixed(2) + ' JOD';
  posCalc();
};

window.posCalc = () => {
  const price = parseFloat(document.getElementById('pos-price-val').value)||0;
  const disc  = parseFloat(document.getElementById('pos-disc').value)||0;
  const tot   = price - price*disc/100;
  const paid  = parseFloat(document.getElementById('pos-paid').value)||0;
  const due   = Math.max(0, tot-paid);
  
  document.getElementById('pos-total-disp').innerText = tot.toFixed(2);
  document.getElementById('pos-due-disp').innerText   = due.toFixed(2) + ' JOD';
  document.getElementById('pos-due-val').value         = due.toFixed(2);
};

window.savePos = async () => {
  const cust = document.getElementById('pos-cust').value.trim();
  const sel  = document.getElementById('pos-prod');
  const prod = sel.options[sel.selectedIndex]?.text;
  
  if (!cust || !sel.value) return swal({ icon:'error', title:'خطأ', text:'أكمل البيانات' });
  
  const price = parseFloat(document.getElementById('pos-price-val').value)||0;
  const disc  = parseFloat(document.getElementById('pos-disc').value)||0;
  const tot   = parseFloat(document.getElementById('pos-total-disp').innerText)||0;
  const paid  = parseFloat(document.getElementById('pos-paid').value)||0;
  const due   = parseFloat(document.getElementById('pos-due-val').value)||0;
  const pay   = document.getElementById('pos-pay').value;
  const invId = 'POS-' + Math.floor(Math.random()*90000+10000);
  
  try {
    await addDoc(collection(db,'invoices'), { invId, pName:cust, prodName:prod, subtotal:price, discountPercent:disc, total:tot, paid, due, paymentMethod:pay, labStatus:'تم التسليم', time:serverTimestamp(), isUnified:false, doctor:Auth.user?.name||'موظف' });
    
    const qty = +sel.options[sel.selectedIndex].dataset.qty;
    if (qty>0) await updateDoc(doc(db,'products',sel.value), { qty:qty-1 });
    
    logAudit(`بيع كاشير: ${invId}`);
    swal({ icon:'success', title:'تم الحفظ', timer:1300, showConfirmButton:false });
    printPos(invId, cust, prod, price, disc, tot, paid, due, pay);
    
    ['pos-cust','pos-paid'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    sel.value='';
    document.getElementById('pos-price-val').value='0';
    document.getElementById('pos-price-disp').innerText='0.00 JOD';
    document.getElementById('pos-disc').value='0';
    posCalc();
  } catch {
    swal({ icon:'error', title:'خطأ', text:'فشل الاتصال' });
  }
};

window.printPosById = (invId) => {
  const r = window.allRecords.find(r=>r.invId===invId);
  if(r) printPos(r.invId,r.pName,r.prodName,r.subtotal,r.discountPercent,r.total,r.paid,r.due,r.paymentMethod);
};

function printPos(invId,cust,prod,price,disc,tot,paid,due,pay) {
  document.getElementById('print-content').innerHTML = `
    <div class="print-card" style="text-align:center;">
      <h2 style="margin:0;">Delta Optics</h2>
      <p>فاتورة: <span class="en">${invId}</span></p>
      <p><span class="en">${new Date().toLocaleDateString('en-GB')}</span></p><hr>
      <p><b>الزبون:</b> ${cust}</p>
      <p><b>المنتج:</b> ${prod}</p><hr>
      <h3>الإجمالي: <span class="en">${tot.toFixed(2)}</span> JOD</h3>
      <p>مدفوع: <span class="en">${paid.toFixed(2)}</span> | باقي: <span class="en">${due.toFixed(2)}</span></p>
    </div>`;
  
  window.print();
  logAudit(`طباعة كاشير: ${invId}`);
}

// ═══════════════════════════════════════════════════════
//  ONLINE TESTS
// ═══════════════════════════════════════════════════════

window.openOnlineReport = (testId) => {
  const r = window.allTests.find(t=>t.id===testId);
  if(!r) return;
  
  document.getElementById('rpt-name').innerText    = r.name||'—';
  document.getElementById('rpt-phone').innerText   = r.phone||'—';
  document.getElementById('rpt-details').innerText = r.details||'لا توجد تفاصيل';
  
  const waMsg = encodeURIComponent(`مرحباً ${r.name}، معك عيادة دلتا للبصريات...`);
  document.getElementById('btn-wa-rpt').href = `https://wa.me/${r.phone?r.phone.replace(/^0/,'962'):'962775549700'}?text=${waMsg}`;
  
  const btn = document.getElementById('btn-done-rpt');
  btn.style.display = r.isProcessed ? 'none' : 'flex';
  
  btn.onclick = async () => {
    await updateDoc(doc(db,'tests',testId), { isProcessed:true });
    closeModal('mod-online');
    logAudit(`مراجعة فحص: ${r.name}`);
    swal({ icon:'success', title:'تم', timer:1300, showConfirmButton:false });
  };
  
  openModal('mod-online');
};

// ═══════════════════════════════════════════════════════
//  INVENTORY
// ═══════════════════════════════════════════════════════

window.compressImage = (event, targetId, previewId=null) => {
  const file = event.target.files[0];
  if(!file) return;
  
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const c=document.createElement('canvas');
      const MAX=600;
      let w=img.width,h=img.height;
      
      if(w>h){if(w>MAX){h*=MAX/w;w=MAX;}}else{if(h>MAX){w*=MAX/h;h=MAX;}}
      
      c.width=w;
      c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      
      document.getElementById(targetId).value = c.toDataURL('image/jpeg',0.6);
      
      if(previewId){
        document.getElementById(previewId).src=document.getElementById(targetId).value;
        document.getElementById(previewId).style.display='block';
      }
      
      swal({ icon:'success', title:'تم', timer:900, showConfirmButton:false });
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
};

let editProdId = null;

window.loadProdEdit = (id, data) => {
  editProdId = id;
  document.getElementById('p-name').value  = data.name;
  document.getElementById('p-price').value = data.price;
  document.getElementById('p-qty').value   = data.qty;
  document.getElementById('p-type').value  = data.type;
  document.getElementById('p-img').value   = data.img||'';
  window.scrollTo({top:0,behavior:'smooth'});
};

window.saveProduct = async () => {
  const name  = document.getElementById('p-name').value.trim();
  const price = document.getElementById('p-price').value;
  const qty   = document.getElementById('p-qty').value;
  const type  = document.getElementById('p-type').value;
  const img   = document.getElementById('p-img').value;
  
  if(!name||!price) return swal({ icon:'warning', title:'تنبيه', text:'أكمل البيانات' });
  
  if(editProdId) {
    await updateDoc(doc(db,'products',editProdId), { name, price:+price, type, qty:+qty, img });
    logAudit(`تعديل منتج: ${name}`);
    swal({ icon:'success', title:'تم التعديل', timer:1300, showConfirmButton:false });
    editProdId=null;
  } else {
    await addDoc(collection(db,'products'), { name, price:+price, type, qty:+qty, img, time:serverTimestamp() });
    logAudit(`إضافة منتج: ${name}`);
    swal({ icon:'success', title:'تم الإضافة', timer:1300, showConfirmButton:false });
  }
  
  ['p-name','p-price','p-qty','p-img'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
};

window.deleteProduct = (id, data) => softDelete('products', id, data, data.name, 'منتج');

// ═══════════════════════════════════════════════════════
//  GALLERY
// ═══════════════════════════════════════════════════════

window.saveGallery = async () => {
  const id   = document.getElementById('gal-id').value;
  const name = document.getElementById('gal-name').value.trim();
  const type = document.getElementById('gal-type').value;
  const img  = document.getElementById('gal-img').value;
  
  if(!name||!img) return swal({ icon:'warning', title:'إجباري', text:'الاسم والصورة مطلوبان' });
  
  if(id) {
    await updateDoc(doc(db,'brands',id),{name,type,imageUrl:img});
    logAudit(`تعديل تشكيلة: ${name}`);
  } else {
    await addDoc(collection(db,'brands'),{name,type,imageUrl:img,timestamp:serverTimestamp()});
    logAudit(`إضافة تشكيلة: ${name}`);
  }
  
  swal({ icon:'success', title:'تم', timer:1300, showConfirmButton:false });
  document.getElementById('gal-id').value='';
  document.getElementById('gal-name').value='';
  document.getElementById('gal-img').value='';
  
  const prev=document.getElementById('gal-prev');
  if(prev){prev.src='';prev.style.display='none';}
};

window.loadGalEdit = (id,name,type,img) => {
  document.getElementById('gal-id').value   = id;
  document.getElementById('gal-name').value = name;
  document.getElementById('gal-type').value = type||'medical';
  document.getElementById('gal-img').value  = img||'';
  
  if(img){
    document.getElementById('gal-prev').src=img;
    document.getElementById('gal-prev').style.display='block';
  }
  
  window.scrollTo({top:0,behavior:'smooth'});
};

window.deleteGallery = (id,data) => softDelete('brands',id,data,data.name,'تشكيلة');

// ═══════════════════════════════════════════════════════
//  LAB
// ═══════════════════════════════════════════════════════

window.updateLab = async (id, status) => {
  await updateDoc(doc(db,'invoices',id),{labStatus:status});
  logAudit(`مختبر: ${status}`);
};

// ═══════════════════════════════════════════════════════
//  CMS
// ═══════════════════════════════════════════════════════

window.saveCMS = async () => {
  const topbar = document.getElementById('cms-topbar').value;
  const mode   = document.getElementById('cms-mode').value;
  const open   = document.getElementById('cms-open').value;
  const close  = document.getElementById('cms-close').value;
  
  await setDoc(doc(db,'settings','cms'),{topbar,statusMode:mode,openTime:open,closeTime:close},{merge:true});
  logAudit('تحديث إعدادات النظام');
  swal({ icon:'success', title:'تم التحديث', timer:1300, showConfirmButton:false });
};

// ═══════════════════════════════════════════════════════
//  REALTIME SYNC
// ═══════════════════════════════════════════════════════

window.startSync = function() {
  onSnapshot(query(collection(db,'brands'),orderBy('timestamp','desc')), s => {
    let html='';
    s.forEach(d=>{ const p=d.data();
      const tb=p.type==='sun'?'<span class="bdg bdg-a">شمسي</span>':'<span class="bdg bdg-b">طبي</span>';
      html+=`<tr><td class="fw">${p.name}</td><td>${tb}</td>
        <td style="display:flex;gap:5px;">
          <button class="btn btn-am btn-sm" onclick='loadGalEdit("${d.id}","${p.name}","${p.type}","${p.imageUrl||''}")'><i class="fas fa-edit"></i></button>
          <button class="btn btn-dn btn-sm" onclick='deleteGallery("${d.id}",${JSON.stringify(p).replace(/'/g,"\\'")})'><i class="fas fa-trash"></i></button>
        </td></tr>`;
    });
    const tb=document.getElementById('tb-gal');
    if(tb){ tb.innerHTML=html; applyRoles(Auth.user?.role||'employee'); }
  });

  onSnapshot(query(collection(db,'products'),orderBy('time','desc')), s => {
    let invH='', posH="<option value=''>— اختر المنتج —</option>";
    s.forEach(d=>{ const p=d.data();
      const qb=p.qty>0?`<span class="bdg bdg-g mono">${p.qty}</span>`:'<span class="bdg bdg-r">نفد</span>';
      invH+=`<tr><td class="fw">${p.name}</td><td><span class="bdg bdg-b">${p.type}</span></td><td>${qb}</td><td class="mono">${p.price} JOD</td>
        <td style="display:flex;gap:5px;">
          <button class="btn btn-am btn-sm" onclick='loadProdEdit("${d.id}",${JSON.stringify(p).replace(/'/g,"\\'")})'><i class="fas fa-edit"></i></button>
          <button class="btn btn-dn btn-sm" onclick='deleteProduct("${d.id}",${JSON.stringify(p).replace(/'/g,"\\'")})'><i class="fas fa-trash"></i></button>
        </td></tr>`;
      if(p.qty>0) posH+=`<option value="${d.id}" data-price="${p.price}" data-qty="${p.qty}">${p.name}</option>`;
    });
    const ti=document.getElementById('tb-inv');
    if(ti) ti.innerHTML=invH;
    const pp=document.getElementById('pos-prod');
    if(pp) pp.innerHTML=posH;
    applyRoles(Auth.user?.role||'employee');
  });

  onSnapshot(query(collection(db,'tests'),orderBy('timestamp','desc')), s => {
    let html='';
    window.allTests=[];
    s.forEach(d=>{ const p=d.data();
      window.allTests.push({id:d.id,...p});
      const dt=p.timestamp?.toDate().toLocaleDateString('en-GB')||'--';
      const st=p.isProcessed?'<span class="bdg bdg-g">مكتمل</span>':'<span class="bdg bdg-a">جديد</span>';
      html+=`<tr><td class="fw">${p.name||'—'}</td><td class="mono">${p.phone||'—'}</td><td class="mono dim">${dt}</td><td>${st}</td>
        <td><button class="btn btn-pr btn-sm" onclick="openOnlineReport('${d.id}')"><i class="fas fa-eye"></i> عرض</button></td></tr>`;
    });
    const tb=document.getElementById('tb-online');
    if(tb) tb.innerHTML=html;
  });

  onSnapshot(query(collection(db,'expenses'),orderBy('time','desc')), s => {
    expData=[];
    s.forEach(d=>expData.push({id:d.id,...d.data()}));
    renderLedger();
  });

  onSnapshot(query(collection(db,'invoices'),orderBy('time','desc')), s => {
    let posH='', labH='';
    let posPatH="<option value=''>—</option>";
    invData=[];
    window.allRecords=[];
    let pts={};
    
    s.forEach(d=>{ const i={...d.data(),id:d.id};
      invData.push(i);
      if(!i.isUnified){
        window.allRecords.push(i);
        const dueCol = +i.due>0?'var(--red)':'var(--green)';
        posH+=`<tr><td class="mono fw">${i.invId}</td><td class="fw">${i.pName}</td><td class="dim">${i.prodName}</td>
          <td class="mono" style="color:var(--blue);">${(+i.total).toFixed(2)} JOD</td>
          <td class="mono" style="color:${dueCol};">${(+i.due).toFixed(2)} JOD</td>
          <td style="display:flex;gap:5px;">
            <button class="btn btn-sc btn-sm" onclick="printPosById('${i.invId}')"><i class="fas fa-print"></i></button>
            <button class="btn btn-dn btn-sm admin-only" onclick='deleteInvoice("${d.id}",${JSON.stringify(i).replace(/'/g,"\\'")},"${i.invId}")'><i class="fas fa-trash"></i></button>
          </td></tr>`;
      }
      if(i.labStatus!=='تم التسليم'){
        labH+=`<tr><td class="mono fw">${i.invId}</td><td class="fw">${i.pName}</td><td class="dim">${i.prodName}</td>
          <td><select onchange="updateLab('${d.id}',this.value)" class="fc" style="padding:5px 9px;font-size:12px;width:125px;">
            <option value="انتظار" ${i.labStatus==='انتظار'?'selected':''}>انتظار</option>
            <option value="جاهز"  ${i.labStatus==='جاهز'?'selected':''}>جاهز</option>
            <option value="تم التسليم">تسليم</option>
          </select></td></tr>`;
      }
      if(i.isUnified&&i.rx){
        window.allRecords.push(i);
        if(!pts[i.pName]) pts[i.pName]={last:i.time?.toDate(),spent:0};
        pts[i.pName].spent+=+i.total;
      }
    });

    const names=Object.keys(pts);
    const dl=document.getElementById('patients-dl');
    if(dl) dl.innerHTML=names.map(n=>`<option value="${n}">`).join('');
    
    let rxH='';
    names.forEach(n=>{
      rxH+=`<tr><td class="fw" style="color:var(--blue);">${n}</td>
        <td class="mono dim">${pts[n].last?.toLocaleDateString('en-GB')||'—'}</td>
        <td class="mono fw">${pts[n].spent.toFixed(2)} JOD</td>
        <td><button class="btn btn-pr btn-sm" onclick="showHistory('${n}')"><i class="fas fa-folder-open"></i> السجل</button></td></tr>`;
      posPatH+=`<option value="${n}">${n}</option>`;
    });

    const t1=document.getElementById('tb-rx');
    if(t1) t1.innerHTML=rxH;
    const t2=document.getElementById('tb-pos');
    if(t2) t2.innerHTML=posH;
    const t3=document.getElementById('tb-lab');
    if(t3) t3.innerHTML=labH;
    const t4=document.getElementById('pos-cust');
    if(t4&&t4.tagName==='SELECT') t4.innerHTML=posPatH;
    
    renderLedger();
    applyRoles(Auth.user?.role||'employee');
  });

  onSnapshot(collection(db,'users'), s => {
    allStaff=[];
    s.forEach(d=>allStaff.push({id:d.id,...d.data()}));
    
    const tb=document.getElementById('tb-accounts');
    if(!tb) return;
    
    tb.innerHTML=allStaff.map(u=>{
      const rb=u.role==='developer'?'<span class="bdg bdg-r">مطور</span>':u.role==='manager'?'<span class="bdg bdg-b">مدير</span>':'<span class="bdg bdg-x">موظف</span>';
      const sb=u.status==='frozen'?'<span class="bdg bdg-r">مجمد</span>':'<span class="bdg bdg-g">نشط</span>';
      const fb=u.status==='frozen'
        ?`<button class="btn btn-gn btn-sm" onclick="toggleFreeze('${u.id}','frozen','${u.name}')"><i class="fas fa-play"></i></button>`
        :`<button class="btn btn-am btn-sm" onclick="toggleFreeze('${u.id}','active','${u.name}')"><i class="fas fa-pause"></i></button>`;
      
      return `<tr>
        <td class="fw">${u.name}</td>
        <td class="mono dim" style="font-size:12px;">${u.user}</td>
        <td>${rb}</td><td>${sb}</td>
        <td style="display:flex;gap:5px;">
          <button class="btn btn-pr btn-sm" onclick="loadAccountForEdit('${u.id}')"><i class="fas fa-edit"></i></button>
          ${fb}
          <button class="btn btn-dn btn-sm" onclick='deleteAccount("${u.id}","${u.name}",${JSON.stringify(u).replace(/'/g,"\\'")})'><i class="fas fa-trash"></i></button>
        </td></tr>`;
    }).join('');
  });

  onSnapshot(query(collection(db,'audit_logs'),orderBy('time','desc'),limit(50)), s => {
    const tb=document.getElementById('tb-audit');
    if(!tb) return;
    
    tb.innerHTML=s.docs.map(d=>{ const p=d.data();
      return `<tr>
        <td class="fw">${p.user}</td>
        <td class="dim">${p.device||'نظام'}</td>
        <td style="color:var(--blue);">${p.action}</td>
        <td class="mono dim">${p.time?.toDate().toLocaleString('en-GB')||'—'}</td></tr>`;
    }).join('');
  });

  onSnapshot(query(collection(db,'recycle_bin'),orderBy('deletedAt','desc')), s => {
    const tb=document.getElementById('tb-recycle');
    if(!tb) return;
    
    tb.innerHTML=s.docs.map(d=>{ const p=d.data();
      return `<tr>
        <td><span class="bdg bdg-r">${p.typeLabel}</span></td>
        <td class="fw">${p.displayName}</td>
        <td class="dim">${p.deletedBy}</td>
        <td class="mono dim">${p.deletedAt?.toDate().toLocaleString('en-GB')||'—'}</td>
        <td><button class="btn btn-gn btn-sm" onclick='restore("${d.id}","${p.originalCol}","${p.originalId}",${JSON.stringify(p.data).replace(/'/g,"\\'")},"${p.displayName}","${p.typeLabel}")'><i class="fas fa-undo"></i> استرجاع</button></td></tr>`;
    }).join('');
  });
}
