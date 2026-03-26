import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { /* ضع مفاتيحك هنا */ };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 1. تفعيل وضع الأوفلاين (Enterprise Offline Persistence)
enableIndexedDbPersistence(db).catch((err) => {
    console.warn("Offline mode info: ", err.code);
});

// Toast Notifications للمظهر الاحترافي
const Toast = Swal.mixin({
    toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true
});

window.showView = (id) => {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById(id).style.display = 'block';
};

// 2. تصدير التقارير إلى Excel (SheetJS)
window.exportToExcel = (tableId, fileName) => {
    const table = document.getElementById(tableId).closest('table');
    const wb = XLSX.utils.table_to_book(table, { sheet: "البيانات" });
    XLSX.writeFile(wb, `${fileName}_${new Date().toLocaleDateString('en-GB')}.xlsx`);
    Toast.fire({ icon: 'success', title: 'تم التصدير بنجاح' });
};

// 3. الرسم البياني للمبيعات (Chart.js)
let salesChartInstance = null;
function updateChart(dataPoints, labels) {
    const ctx = document.getElementById('salesChart');
    if(!ctx) return;
    if (salesChartInstance) salesChartInstance.destroy();
    
    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'المبيعات (JOD)',
                data: dataPoints,
                backgroundColor: '#2563eb',
                borderRadius: 8
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
}

// 4. إدارة البيانات المباشرة وتنبيهات النواقص
onSnapshot(query(collection(db, "products"), orderBy("time", "desc")), (s) => {
    let invHtml = "";
    let lowStockCount = 0;
    
    s.forEach(d => { 
        const p = d.data(); 
        const isLowStock = p.qty < 5;
        if(isLowStock) lowStockCount++;
        
        invHtml += `<tr>
            <td>${p.name}</td>
            <td class="en-num ${isLowStock ? 'stock-alert' : ''}">${p.qty} ${isLowStock ? '⚠️ (نقص)' : ''}</td>
            <td class="en-num">${p.price}</td>
        </tr>`; 
    });
    
    // جرس التنبيهات في الهيدر
    const bell = document.getElementById('stock-bell');
    if(bell) {
        bell.style.color = lowStockCount > 0 ? 'var(--danger)' : 'var(--text-muted)';
        bell.classList.toggle('fa-shake', lowStockCount > 0);
    }
    
    if(document.getElementById('tb-inv')) document.getElementById('tb-inv').innerHTML = invHtml;
});

// سحب بيانات الفواتير وتحديث الرسم البياني والأرشيف
onSnapshot(query(collection(db, "invoices"), orderBy("time", "desc")), (s) => {
    let tbUnifiedHTML = ""; 
    let salesByDate = {};

    s.forEach(d => { 
        const i = d.data(); 
        const dateStr = i.time ? i.time.toDate().toLocaleDateString('en-GB') : 'اليوم';
        
        // تجميع المبيعات للرسم البياني
        if(!salesByDate[dateStr]) salesByDate[dateStr] = 0;
        salesByDate[dateStr] += Number(i.total);

        // تعبئة الأرشيف
        if (i.isUnified) {
            tbUnifiedHTML += `<tr>
                <td style="font-weight:bold; color:var(--primary);">${i.pName}</td>
                <td class="en-num">${dateStr}</td>
                <td class="en-num" style="font-weight:bold;">${Number(i.total).toFixed(2)}</td>
            </tr>`;
        }
    });

    if(document.getElementById('tb-unified-rx')) document.getElementById('tb-unified-rx').innerHTML = tbUnifiedHTML;
    
    // تحديث الرسم البياني (آخر 7 أيام)
    const labels = Object.keys(salesByDate).slice(0, 7).reverse();
    const dataPoints = Object.values(salesByDate).slice(0, 7).reverse();
    updateChart(dataPoints, labels);
});
