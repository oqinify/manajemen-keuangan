// =========================================================================
// PENTING: Ganti URL di bawah dengan URL Web App Google Apps Script Anda!
// =========================================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwb0XluQdEiC5mJtxfoAutyF7xpvux-3hSX8AWvx3SOO4UlxrnQ8nFg4-j_i7B3J66Uww/exec';

// Initial state and DOM elements
let transactions = [];
let masterOutputs = [];
let masterMethods = [];
let masterSources = [];
let editingTransactionId = null;
let isReceiptDeleted = false;
let charts = {};

const modalTitleEl = document.getElementById('modal-title');
const balanceEl = document.getElementById('total-balance');
const incomeEl = document.getElementById('total-income');
const expenseEl = document.getElementById('total-expense');
const listEl = document.getElementById('transaction-list'); // may be null in new layout
const formEl = document.getElementById('transaction-form');
const dateEl = document.getElementById('date');
const typeEl = document.getElementsByName('type');
const outputEl = document.getElementById('output');
const amountEl = document.getElementById('amount');
const paymentMethodEl = document.getElementById('payment-method');
const fundSourceEl = document.getElementById('fund-source');
const descriptionEl = document.getElementById('description');
const receiptEl = document.getElementById('receipt');
const emptyStateEl = document.getElementById('empty-state');
const submitBtn = document.querySelector('.btn-submit');
const modalEl = document.getElementById('transaction-modal');
const openModalBtn = document.getElementById('open-modal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const removeReceiptBtn = document.getElementById('remove-receipt-btn');
const previewContainer = document.getElementById('receipt-preview');
const itemsContainer = document.getElementById('description-items-container');
const addItemBtn = document.getElementById('add-desc-item-btn');

// Modal functions
const openModal = () => {
    modalEl.classList.add('active');
    setTodayDate();
};

const closeModal = () => {
    modalEl.classList.remove('active');
    descriptionEl.value = '';
    amountEl.value = '';
    outputEl.value = '';
    paymentMethodEl.value = '';
    fundSourceEl.value = '';
    receiptEl.value = '';

    // Reset Reminder fields
    const reminderCheckbox = document.getElementById('enable-reminder');
    const reminderSettings = document.getElementById('reminder-settings');
    const reminderTimeInput = document.getElementById('reminder-time');
    if (reminderCheckbox) reminderCheckbox.checked = false;
    if (reminderSettings) reminderSettings.style.display = 'none';
    if (reminderTimeInput) reminderTimeInput.value = '';

    editingTransactionId = null;
    isReceiptDeleted = false;
    resetDescriptionItems();
    if (modalTitleEl) modalTitleEl.innerText = 'Tambah Transaksi Baru';
    if (previewContainer) previewContainer.style.display = 'none';
};

// Item list management
const calculateTotal = () => {
    const rows = itemsContainer.querySelectorAll('.desc-item-row');
    const count = rows.length;

    rows.forEach(row => {
        const qtyInput = row.querySelector('.desc-item-qty');
        const amtInput = row.querySelector('.desc-item-amount');
        const removeBtn = row.querySelector('.btn-remove-item');
        const subtotalEl = row.querySelector('.desc-item-subtotal');

        if (qtyInput) { qtyInput.style.display = ''; qtyInput.required = true; }
        if (amtInput) { amtInput.style.display = ''; amtInput.required = true; }
        if (removeBtn) { removeBtn.style.display = count > 1 ? '' : 'none'; }

        // Calculate subtotal for each row
        const q = parseFloat(qtyInput.value) || 0;
        const p = parseFloat(amtInput.value) || 0;
        const sub = q * p;

        if (subtotalEl) {
            // Show subtotal if Qty > 1 and price > 0
            if (q > 1 && p > 0) {
                subtotalEl.innerText = 'Total: ' + formatCurrency(sub);
                subtotalEl.style.display = 'block';
            } else {
                subtotalEl.style.display = 'none';
            }
        }
    });

    if (count === 1) {
        amountEl.disabled = false;
        amountEl.readOnly = false;
        amountEl.removeEventListener('input', syncSingleItemAmount);
        amountEl.addEventListener('input', syncSingleItemAmount);

        const price = parseFloat(rows[0].querySelector('.desc-item-amount').value) || 0;
        const qty = parseFloat(rows[0].querySelector('.desc-item-qty').value) || 0;
        if (price > 0) amountEl.value = price * qty;
    } else {
        amountEl.disabled = true;
        amountEl.readOnly = true;
        amountEl.removeEventListener('input', syncSingleItemAmount);

        let total = 0;
        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.desc-item-qty').value) || 0;
            const price = parseFloat(row.querySelector('.desc-item-amount').value) || 0;
            total += (qty * price);
        });
        amountEl.value = total > 0 ? total : '';
    }
};

const syncSingleItemAmount = () => {
    const rows = itemsContainer.querySelectorAll('.desc-item-row');
    if (rows.length === 1) {
        rows[0].querySelector('.desc-item-amount').value = amountEl.value;
        rows[0].querySelector('.desc-item-qty').value = 1;
    }
};

const createItemRow = (name = '', qty = 1, amount = '') => {
    const row = document.createElement('div');
    row.className = 'desc-item-row';
    row.innerHTML = `
        <div class="desc-item-name-row">
            <input type="text" class="desc-item-input" placeholder="Nama item..." value="${name}" required>
        </div>
        <div class="desc-item-inputs-row">
            <input type="number" class="desc-item-qty" placeholder="Qty" value="${qty}" min="1" step="any" required>
            <input type="number" class="desc-item-amount" placeholder="Harga Satuan..." value="${amount}" required>
            <button type="button" class="btn-remove-item" title="Hapus Item">
                <i class='bx bx-x'></i>
            </button>
        </div>
        <div class="desc-item-subtotal"></div>
    `;

    // Add listeners for total calculation
    row.querySelector('.desc-item-qty').addEventListener('input', calculateTotal);
    row.querySelector('.desc-item-amount').addEventListener('input', calculateTotal);

    row.querySelector('.btn-remove-item').addEventListener('click', () => {
        if (itemsContainer.querySelectorAll('.desc-item-row').length > 1) {
            row.remove();
            calculateTotal();
        } else {
            row.querySelector('.desc-item-input').value = '';
            row.querySelector('.desc-item-qty').value = 1;
            row.querySelector('.desc-item-amount').value = '';
            calculateTotal();
        }
    });

    return row;
};

const resetDescriptionItems = () => {
    itemsContainer.innerHTML = '';
    itemsContainer.appendChild(createItemRow());
    if (amountEl) {
        amountEl.value = '';
        amountEl.disabled = false;
    }
    calculateTotal();
};

if (addItemBtn) {
    addItemBtn.addEventListener('click', () => {
        itemsContainer.appendChild(createItemRow());
        calculateTotal();
        const inputs = itemsContainer.querySelectorAll('.desc-item-input');
        inputs[inputs.length - 1].focus();
    });
}

const getJoinedDescription = () => {
    const rows = itemsContainer.querySelectorAll('.desc-item-row');
    const items = Array.from(rows).map(row => {
        const name = row.querySelector('.desc-item-input').value.trim();
        const qty = row.querySelector('.desc-item-qty').value.trim() || 1;
        const amt = row.querySelector('.desc-item-amount').value.trim();
        if (name === '') return '';
        return amt !== '' ? `${name} [${qty} x ${amt}]` : name;
    }).filter(v => v !== '');
    return items.join(' | ');
};

const setSplitDescription = (text) => {
    itemsContainer.innerHTML = '';
    if (!text || text.trim() === '') {
        itemsContainer.appendChild(createItemRow());
        calculateTotal();
        return;
    }

    const items = text.split(' | ');
    items.forEach(item => {
        // Try to parse "Name [Qty x Amount]"
        const match = item.match(/(.*) \[(.*) x (.*)\]/);
        if (match) {
            itemsContainer.appendChild(createItemRow(match[1], match[2], match[3]));
        } else {
            // Fallback for old format "Name [Amount]"
            const oldMatch = item.match(/(.*) \[(.*)\]/);
            if (oldMatch) {
                itemsContainer.appendChild(createItemRow(oldMatch[1], 1, oldMatch[2]));
            } else {
                itemsContainer.appendChild(createItemRow(item));
            }
        }
    });
    calculateTotal();
};

// Format currency to IDR
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

// Format date to Indonesian format
const formatDate = (dateString) => {
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    try {
        return new Date(dateString).toLocaleDateString('id-ID', options);
    } catch (e) {
        return dateString;
    }
};

// Helper to compress image
const compressImage = (file, maxWidth = 1024, quality = 0.7) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve({
                    base64: dataUrl.split(',')[1],
                    mimeType: 'image/jpeg',
                    name: file.name.replace(/\.[^/.]+$/, "") + ".jpg"
                });
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

// Set today's date as default in form
const setTodayDate = () => {
    const today = new Date().toISOString().split('T')[0];
    dateEl.value = today;
};

// Toast Notification System
const showToast = (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'bx-info-circle';
    if (type === 'success') icon = 'bx-check-circle';
    if (type === 'error') icon = 'bx-error-circle';

    toast.innerHTML = `
        <i class='bx ${icon}'></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// Notification Permission Request
const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            showToast('Notifikasi diaktifkan!', 'success');
            // Send welcome notification
            new Notification('FinansialKu', {
                body: 'Notifikasi berhasil diaktifkan. Kami akan mengingatkan Anda untuk mencatat transaksi.',
                icon: 'https://cdn-icons-png.flaticon.com/512/2488/2488744.png'
            });
        }
    }
};

// Initialize app
const init = async () => {
    setTodayDate();
    resetDescriptionItems();

    try {
        await fetchTransactions();
    } finally {
        // Hide splash screen after small delay for smooth transition
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash) splash.classList.add('hidden');

            // Request notification permission after splash is gone
            requestNotificationPermission();
        }, 800);
    }
};

const showTableMessage = (html, color = '') => {
    const tbody = document.getElementById('tx-table-body');
    const tableEl = document.getElementById('tx-table');
    const emptyEl = document.getElementById('empty-state');
    if (tableEl) tableEl.style.display = 'none';
    if (tbody) tbody.innerHTML = '';
    if (emptyEl) {
        emptyEl.style.display = 'flex';
        emptyEl.innerHTML = html;
        if (color) emptyEl.style.color = color;
        else emptyEl.style.color = '';
    }
};

const setLoadingState = (isLoading) => {
    if (isLoading) {
        showTableMessage(`<i class="bx bx-loader-alt bx-spin"></i><p>Memuat data dari Google Sheets...</p>`);
    }
};

// Fetch transactions from Google Sheets
const fetchTransactions = async () => {
    if (SCRIPT_URL === 'ISI_URL_WEB_APP_GOOGLE_SCRIPT_ANDA_DI_SINI') {
        showTableMessage(
            `<i class="bx bx-error"></i><p>URL Web App belum diisi! Silakan edit app.js baris ke-4.</p>`,
            'var(--expense-color)'
        );
        return;
    }

    setLoadingState(true);
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();

        // Cek apakah data dari format baru (object) atau lama (array)
        if (Array.isArray(data)) {
            transactions = data;
        } else {
            transactions = data.transactions || [];
            masterOutputs = data.masterOutputs || [];
            masterMethods = data.masterMethods || [];
            masterSources = data.masterSources || [];
            updateMasterDatalist();
            updateMasterMethods();
            updateMasterSources();
        }

        updateUI();
    } catch (error) {
        console.error('Error fetching data:', error);
        showTableMessage(
            `<i class="bx bx-error"></i><p>Gagal memuat data. Periksa koneksi atau URL Script.</p>`,
            'var(--expense-color)'
        );
    }
};

// Update all UI elements
const updateUI = () => {
    updateSummary();
    renderDashboard();
    renderTransactions();
};

// Calculate and update summary cards
const updateSummary = () => {
    const amounts = transactions.map(t => t.type === 'income' ? t.amount : -t.amount);

    const total = amounts.reduce((acc, item) => (acc += item), 0);
    const income = amounts.filter(item => item > 0).reduce((acc, item) => (acc += item), 0);
    const expense = amounts.filter(item => item < 0).reduce((acc, item) => (acc += item), 0) * -1;

    balanceEl.innerText = formatCurrency(total);
    incomeEl.innerText = formatCurrency(income);
    expenseEl.innerText = formatCurrency(expense);

    if (total < 0) {
        balanceEl.style.color = 'var(--expense-color)';
    } else {
        balanceEl.style.color = 'inherit';
    }
};

// Update Datalist for Master Outputs
const updateMasterDatalist = () => {
    const datalist = document.getElementById('master-outputs');
    if (!datalist) return;

    datalist.innerHTML = '';
    masterOutputs.forEach(output => {
        const option = document.createElement('option');
        option.value = output;
        datalist.appendChild(option);
    });
};

// Update Select Options for Master Methods
const updateMasterMethods = () => {
    const selectEl = document.getElementById('payment-method');
    if (!selectEl) return;

    const currentValue = selectEl.value;
    selectEl.innerHTML = '<option value="" disabled selected>Pilih Metode Pembayaran...</option>';

    masterMethods.forEach(method => {
        const option = document.createElement('option');
        option.value = method;
        option.textContent = method;
        selectEl.appendChild(option);
    });

    if (currentValue && masterMethods.includes(currentValue)) {
        selectEl.value = currentValue;
    }
};

// Update Datalist for Master Sources
const updateMasterSources = () => {
    const datalist = document.getElementById('master-sources');
    if (!datalist) return;

    datalist.innerHTML = '';
    masterSources.forEach(source => {
        const option = document.createElement('option');
        option.value = source;
        datalist.appendChild(option);
    });
};

// Handle dynamic label changes based on transaction type
const typeRadios = document.getElementsByName('type');
const outputLabel = document.querySelector('label[for="output"]');

typeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        const type = e.target.value;
        if (outputLabel) {
            outputLabel.innerText = type === 'income' ? 'Kategori Pemasukan' : 'Kategori Pengeluaran';
        }
    });
});

// Helper to get period data
const getPeriodData = (periodId) => {
    const now = new Date();
    const selectEl = document.getElementById(periodId);
    const period = selectEl ? selectEl.value : 'monthly';
    let currentTrans = [];
    let prevTrans = [];
    let labelCur = 'Bulan Ini';
    let labelPrev = 'Bulan Lalu';

    if (period === 'monthly') {
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        currentTrans = transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        prevTrans = transactions.filter(t => {
            const d = new Date(t.date);
            let pm = currentMonth - 1;
            let py = currentYear;
            if (pm < 0) { pm = 11; py--; }
            return d.getMonth() === pm && d.getFullYear() === py;
        });
    } else if (period === 'weekly') {
        labelCur = 'Minggu Ini';
        labelPrev = 'Minggu Lalu';

        const msPerDay = 24 * 60 * 60 * 1000;
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        currentTrans = transactions.filter(t => {
            const d = new Date(t.date).getTime();
            const diffDays = (startOfToday - d) / msPerDay;
            return diffDays >= -1 && diffDays <= 6;
        });

        prevTrans = transactions.filter(t => {
            const d = new Date(t.date).getTime();
            const diffDays = (startOfToday - d) / msPerDay;
            return diffDays > 6 && diffDays <= 13;
        });
    } else if (period === 'yearly') {
        labelCur = 'Tahun Ini';
        labelPrev = 'Tahun Lalu';
        const currentYear = now.getFullYear();

        currentTrans = transactions.filter(t => new Date(t.date).getFullYear() === currentYear);
        prevTrans = transactions.filter(t => new Date(t.date).getFullYear() === currentYear - 1);
    } else if (period === 'all') {
        labelCur = 'Semua Data';
        labelPrev = '-';
        currentTrans = transactions;
        prevTrans = [];
    }

    return { currentTrans, prevTrans, labelCur, labelPrev, period, now };
};

const renderCategoryChart = () => {
    if (typeof Chart === 'undefined') return;
    const pCat = getPeriodData('period-cat');
    const expensesByCategory = {};
    pCat.currentTrans.filter(t => t.type === 'expense').forEach(t => {
        expensesByCategory[t.output] = (expensesByCategory[t.output] || 0) + t.amount;
    });

    const catLabels = Object.keys(expensesByCategory);
    const catData = Object.values(expensesByCategory);
    const bgColors = ['#f97316', '#8b5cf6', '#10b981', '#64748b', '#0ea5e9', '#ef4444', '#f43f5e', '#14b8a6'];

    if (charts.expenseCategory) charts.expenseCategory.destroy();
    charts.expenseCategory = new Chart(document.getElementById('expenseCategoryChart'), {
        type: 'doughnut',
        data: { labels: catLabels, datasets: [{ data: catData, backgroundColor: bgColors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
};

const renderComparisonChart = () => {
    if (typeof Chart === 'undefined') return;
    const pComp = getPeriodData('period-comp');

    // Fallback labels to all outputs to keep it consistent or just ones with data
    const allExpenseCats = new Set();
    pComp.currentTrans.filter(t => t.type === 'expense').forEach(t => allExpenseCats.add(t.output));
    pComp.prevTrans.filter(t => t.type === 'expense').forEach(t => allExpenseCats.add(t.output));
    const compLabels = Array.from(allExpenseCats);

    const compDataCurrent = compLabels.map(cat => {
        return pComp.currentTrans.filter(t => t.type === 'expense' && t.output === cat).reduce((s, t) => s + t.amount, 0);
    });
    const compDataPrev = compLabels.map(cat => {
        return pComp.prevTrans.filter(t => t.type === 'expense' && t.output === cat).reduce((s, t) => s + t.amount, 0);
    });

    if (charts.expenseComparison) charts.expenseComparison.destroy();
    charts.expenseComparison = new Chart(document.getElementById('expenseComparisonChart'), {
        type: 'bar',
        data: {
            labels: compLabels,
            datasets: [
                { label: pComp.labelCur, data: compDataCurrent, backgroundColor: '#ef4444', borderRadius: 4 },
                { label: pComp.labelPrev, data: compDataPrev, backgroundColor: '#64748b', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { grid: { color: 'rgba(148, 163, 184, 0.1)' } }, x: { grid: { display: false } } }
        }
    });
};

const renderTopExpenses = () => {
    const pTop = getPeriodData('period-top');
    const topExpenses = pTop.currentTrans.filter(t => t.type === 'expense')
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

    const tbody = document.getElementById('top-expenses-body');
    if (tbody) {
        tbody.innerHTML = '';
        topExpenses.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDate(t.date)}</td>
                <td><div class="cat-label"><i class='bx bx-purchase-tag'></i> ${t.output}</div></td>
                <td class="expense-val">${formatCurrency(t.amount)}</td>
                <td>${t.description}</td>
            `;
            tbody.appendChild(tr);
        });
        if (topExpenses.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem;">Belum ada pengeluaran pada periode ini.</td></tr>`;
        }
    }
};

const renderTrendChart = () => {
    if (typeof Chart === 'undefined') return;
    const pTrend = getPeriodData('period-trend');
    const incomeByDate = {};
    const trendLabels = [];

    if (pTrend.period === 'monthly') {
        const currentMonth = pTrend.now.getMonth();
        const currentYear = pTrend.now.getFullYear();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) trendLabels.push(i);

        pTrend.currentTrans.filter(t => t.type === 'income').forEach(t => {
            const day = new Date(t.date).getDate();
            incomeByDate[day] = (incomeByDate[day] || 0) + t.amount;
        });
    } else {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(pTrend.now.getTime() - i * 24 * 60 * 60 * 1000);
            trendLabels.push(d.getDate());
        }

        pTrend.currentTrans.filter(t => t.type === 'income').forEach(t => {
            const day = new Date(t.date).getDate();
            incomeByDate[day] = (incomeByDate[day] || 0) + t.amount;
        });
    }

    const trendData = trendLabels.map(day => incomeByDate[day] || 0);

    if (charts.incomeTrend) charts.incomeTrend.destroy();
    charts.incomeTrend = new Chart(document.getElementById('incomeTrendChart'), {
        type: 'line',
        data: {
            labels: trendLabels,
            datasets: [{
                label: 'Pemasukan',
                data: trendData,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { grid: { color: 'rgba(148, 163, 184, 0.1)' } }, x: { grid: { display: false } } },
            plugins: { legend: { display: false } }
        }
    });
};

// Render All Dashboard Charts and Tables
const renderDashboard = () => {
    if (typeof Chart !== 'undefined') Chart.defaults.color = '#94a3b8';
    renderCategoryChart();
    renderComparisonChart();
    renderTopExpenses();
    renderTrendChart();
};

// ===== TABLE STATE =====
let txSortKey = 'date';
let txSortDir = 'desc';
let txCurrentPage = 1;
let txPerPage = 10;

// ===== POPULATE FILTER DROPDOWNS =====
const populateFilterDropdowns = () => {
    const catSel = document.getElementById('filter-category');
    const methodSel = document.getElementById('filter-method');
    if (!catSel || !methodSel) return;

    const cats = [...new Set(transactions.map(t => t.output).filter(Boolean))].sort();
    const methods = [...new Set(transactions.map(t => t.fundSource).filter(Boolean))].sort();

    const savedCat = catSel.value;
    const savedMethod = methodSel.value;

    catSel.innerHTML = '<option value="">Semua Output</option>';
    cats.forEach(c => { catSel.innerHTML += `<option value="${c}">${c}</option>`; });
    if (savedCat) catSel.value = savedCat;

    methodSel.innerHTML = '<option value="">Semua Sumber Dana</option>';
    methods.forEach(m => { methodSel.innerHTML += `<option value="${m}">${m}</option>`; });
    if (savedMethod) methodSel.value = savedMethod;
};

// ===== GET FILTERED + SORTED TRANSACTIONS =====
const getFilteredTransactions = () => {
    const search = (document.getElementById('tx-search')?.value || '').toLowerCase();
    const fType = document.getElementById('filter-type')?.value || '';
    const fCat = document.getElementById('filter-category')?.value || '';
    const fMethod = document.getElementById('filter-method')?.value || '';

    let result = transactions.filter(t => {
        const matchSearch = !search ||
            (t.output || '').toLowerCase().includes(search) ||
            (t.description || '').toLowerCase().includes(search) ||
            (t.paymentMethod || '').toLowerCase().includes(search) ||
            (t.fundSource || '').toLowerCase().includes(search) ||
            formatDate(t.date).toLowerCase().includes(search) ||
            t.amount.toString().includes(search);
        const matchType = !fType || t.type === fType;
        const matchCat = !fCat || t.output === fCat;
        const matchMethod = !fMethod || t.fundSource === fMethod;
        return matchSearch && matchType && matchCat && matchMethod;
    });

    result.sort((a, b) => {
        let va = a[txSortKey];
        let vb = b[txSortKey];
        if (txSortKey === 'date') { va = new Date(va); vb = new Date(vb); }
        if (txSortKey === 'amount') { va = +va; vb = +vb; }
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return txSortDir === 'asc' ? -1 : 1;
        if (va > vb) return txSortDir === 'asc' ? 1 : -1;
        return 0;
    });

    return result;
};

// ===== RENDER TABLE =====
const renderTransactions = () => {
    populateFilterDropdowns();

    const filtered = getFilteredTransactions();
    const totalPages = Math.max(1, Math.ceil(filtered.length / txPerPage));
    if (txCurrentPage > totalPages) txCurrentPage = totalPages;

    const start = (txCurrentPage - 1) * txPerPage;
    const pageData = filtered.slice(start, start + txPerPage);

    const tbody = document.getElementById('tx-table-body');
    const emptyEl = document.getElementById('empty-state');
    const tableEl = document.getElementById('tx-table');

    if (!tbody) return;

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        if (tableEl) tableEl.style.display = 'none';
        if (emptyEl) {
            emptyEl.style.display = 'flex';
            emptyEl.style.color = '';
            emptyEl.innerHTML = `<i class='bx bx-receipt'></i><p>Belum ada transaksi.</p>`;
        }
    } else {
        if (tableEl) tableEl.style.display = '';
        if (emptyEl) emptyEl.style.display = 'none';

        pageData.forEach(t => {
            const sign = t.type === 'income' ? '+' : '-';
            const amtClass = t.type === 'income' ? 'tx-amount-income' : 'tx-amount-expense';
            const typeLabel = t.type === 'income' ? 'Masuk' : 'Keluar';
            const typeIcon = t.type === 'income' ? `<i class='bx bx-trending-up'></i>` : `<i class='bx bx-trending-down'></i>`;
            const methodIcon = `<i class='bx bx-transfer-alt'></i>`;

            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.onclick = () => viewTransaction(t.id);
            tr.innerHTML = `
                <td>${formatDate(t.date)}</td>
                <td><span class="tx-badge ${t.type}">${typeIcon} ${typeLabel}</span></td>
                <td><span class="${amtClass}">${sign}${formatCurrency(t.amount)}</span></td>
                <td style="white-space: normal; line-height: 1.4; width: 100%;">
                    <div style="font-weight: 500; color: var(--text-main); margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 1px; min-width: 100%;">${t.description || '-'}</div>
                    <div style="font-size: 0.82rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.4rem;">
                        <i class='bx bx-purchase-tag'></i> ${t.output || '-'} &bull; 
                        <i class='bx bx-transfer-alt'></i> ${t.fundSource || '-'}
                        ${t.reminder ? `<i class='bx bx-bell' style='color: var(--accent-primary); font-size: 0.8rem; margin-left: 2px;' title='Ada Pengingat'></i>` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Update sort header indicators
    document.querySelectorAll('.tx-table th[data-sort]').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === txSortKey) th.classList.add(txSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    });

    // Update info text
    const infoEl = document.getElementById('tx-info');
    if (infoEl) {
        const end = Math.min(start + txPerPage, filtered.length);
        infoEl.textContent = filtered.length > 0 ? `Menampilkan ${start + 1}–${end} dari ${filtered.length} data` : 'Tidak ada data';
    }

    // Render pagination
    renderPagination(totalPages);
};

// ===== PAGINATION =====
const renderPagination = (totalPages) => {
    const container = document.getElementById('tx-pages');
    if (!container) return;
    container.innerHTML = '';

    const makeBtn = (label, page, isActive = false, disabled = false) => {
        const btn = document.createElement('button');
        btn.className = 'tx-page-btn' + (isActive ? ' active' : '');
        btn.innerHTML = label;
        btn.disabled = disabled;
        if (!disabled) btn.addEventListener('click', () => { txCurrentPage = page; renderTransactions(); });
        return btn;
    };

    container.appendChild(makeBtn('<i class="bx bx-chevron-left"></i>', txCurrentPage - 1, false, txCurrentPage === 1));

    const range = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= txCurrentPage - 1 && i <= txCurrentPage + 1)) {
            range.push(i);
        } else if (range[range.length - 1] !== '...') {
            range.push('...');
        }
    }

    range.forEach(p => {
        if (p === '...') {
            const span = document.createElement('span');
            span.textContent = '...';
            span.style.cssText = 'color: var(--text-muted); padding: 0 0.25rem;';
            container.appendChild(span);
        } else {
            container.appendChild(makeBtn(p, p, p === txCurrentPage));
        }
    });

    container.appendChild(makeBtn('<i class="bx bx-chevron-right"></i>', txCurrentPage + 1, false, txCurrentPage === totalPages));
};

// ===== VIEW DETAIL MODAL =====
window.viewTransaction = (id) => {
    const t = transactions.find(tx => tx.id.toString() === id.toString());
    if (!t) return;

    let overlay = document.getElementById('view-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'view-modal-overlay';
        overlay.className = 'view-modal-overlay';
        overlay.innerHTML = `
            <div class="view-modal-content">
                <div class="view-modal-header">
                    <h3><i class='bx bx-receipt'></i> Detail Transaksi</h3>
                    <button class="btn-close-modal" id="close-view-modal">&times;</button>
                </div>
                <div id="view-modal-body"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('active'); });
        document.getElementById('close-view-modal').addEventListener('click', () => overlay.classList.remove('active'));
    }

    const body = document.getElementById('view-modal-body');
    const sign = t.type === 'income' ? '+' : '-';
    const amtColor = t.type === 'income' ? 'var(--income-color)' : 'var(--expense-color)';
    body.innerHTML = `
        <div class="view-detail-row"><span class="view-detail-label">Tanggal</span><span class="view-detail-value">${formatDate(t.date)}</span></div>
        <div class="view-detail-row"><span class="view-detail-label">Jenis</span><span class="view-detail-value">${t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</span></div>
        <div class="view-detail-row"><span class="view-detail-label">Kategori</span><span class="view-detail-value">${t.output || '-'}</span></div>
        <div class="view-detail-row"><span class="view-detail-label">Nominal</span><span class="view-detail-value" style="color:${amtColor}">${sign}${formatCurrency(t.amount)}</span></div>
        <div class="view-detail-row"><span class="view-detail-label">Metode</span><span class="view-detail-value">${t.paymentMethod || '-'}</span></div>
        <div class="view-detail-row"><span class="view-detail-label">Sumber Dana</span><span class="view-detail-value">${t.fundSource || '-'}</span></div>
        <div class="view-detail-row" style="flex-direction:column; align-items:flex-start; border-bottom: 1px solid var(--card-border); padding-bottom: 1rem;">
            <span class="view-detail-label" style="margin-bottom: 0.5rem;">Daftar Item / Keterangan</span>
            <div style="width: 100%; display: flex; flex-direction: column; gap: 0.25rem;">
                ${(t.description || '-').split(' | ').map(item => {
            const match = item.match(/(.*) \[(.*) x (.*)\]/);
            if (match) {
                return `
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; background: var(--item-bg); padding: 0.4rem 0.6rem; border-radius: 6px;">
                            <span style="font-weight: 600; color: var(--text-main);">${match[1]}</span>
                            <span style="color: var(--text-muted);">${match[2]} x ${formatCurrency(match[3])}</span>
                        </div>`;
            }
            return `<div style="font-size: 0.85rem; background: var(--item-bg); padding: 0.4rem 0.6rem; border-radius: 6px; color: var(--text-main);">${item}</div>`;
        }).join('')}
            </div>
        </div>
        <div class="view-detail-row">
            <span class="view-detail-label">Bukti</span>
            <span class="view-detail-value">
                ${(t.receiptUrl && t.receiptUrl.startsWith('http')) ?
            `<a href="${t.receiptUrl}" target="_blank" class="btn-primary" style="padding: 0.25rem 0.75rem; font-size: 0.8rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem;">
                        <i class='bx bx-show'></i> Lihat
                    </a>` :
            `<span style="color: var(--text-muted); font-weight: normal; font-size: 0.85rem;">${t.receiptUrl && t.receiptUrl.includes('Error') ? 'Gagal Unggah' : 'Tidak ada bukti'}</span>`
        }
            </span>
        </div>
        ${t.reminder ? `
        <div class="view-detail-row" style="background: rgba(59, 130, 246, 0.05); padding: 0.5rem; border-radius: 8px; margin-top: 0.5rem;">
            <span class="view-detail-label" style="color: var(--accent-primary)"><i class='bx bx-bell'></i> Pengingat</span>
            <span class="view-detail-value" style="color: var(--accent-primary); font-weight: 600;">${formatDate(t.reminder)} ${new Date(t.reminder).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>` : ''}
        
        <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
            <button class="btn-primary" style="flex: 1; background: var(--card-border); color: var(--text-main);" onclick="closeViewAndEdit('${t.id}')">
                <i class='bx bx-edit'></i> Edit
            </button>
            <button class="btn-primary" style="flex: 1; background: var(--danger-color);" onclick="closeViewAndDelete('${t.id}', this)">
                <i class='bx bx-trash'></i> Hapus
            </button>
        </div>
    `;
    overlay.classList.add('active');
};

window.closeViewAndEdit = (id) => {
    document.getElementById('view-modal-overlay').classList.remove('active');
    editTransaction(id);
};

window.closeViewAndDelete = (id, btn) => {
    removeTransaction(id, btn);
};

// ===== TABLE SORT & FILTER EVENTS =====
const initTableEvents = () => {
    document.querySelectorAll('.tx-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (txSortKey === key) {
                txSortDir = txSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                txSortKey = key;
                txSortDir = 'desc';
            }
            txCurrentPage = 1;
            renderTransactions();
        });
    });

    ['tx-search', 'filter-type', 'filter-category', 'filter-method'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => { txCurrentPage = 1; renderTransactions(); });
    });

    const perPageEl = document.getElementById('tx-per-page');
    if (perPageEl) perPageEl.addEventListener('change', () => {
        txPerPage = +perPageEl.value;
        txCurrentPage = 1;
        renderTransactions();
    });

    // Dashboard period independent update
    const periodCat = document.getElementById('period-cat');
    if (periodCat) periodCat.addEventListener('change', renderCategoryChart);

    const periodComp = document.getElementById('period-comp');
    if (periodComp) periodComp.addEventListener('change', renderComparisonChart);

    const periodTop = document.getElementById('period-top');
    if (periodTop) periodTop.addEventListener('change', renderTopExpenses);

    const periodTrend = document.getElementById('period-trend');
    if (periodTrend) periodTrend.addEventListener('change', renderTrendChart);
};

// Add new transaction
const addTransaction = async (e) => {
    e.preventDefault();

    if (SCRIPT_URL === 'ISI_URL_WEB_APP_GOOGLE_SCRIPT_ANDA_DI_SINI') {
        alert('Silakan masukkan URL Web App Google Apps Script Anda di app.js');
        return;
    }

    const type = document.querySelector('input[name="type"]:checked').value;
    const date = dateEl.value;
    const output = outputEl.value.trim();
    const amount = +amountEl.value;
    const paymentMethod = paymentMethodEl.value.trim();
    const fundSource = fundSourceEl.value.trim();
    const description = getJoinedDescription();

    if (description === '' || isNaN(amount) || amount <= 0 || date === '' || output === '' || paymentMethod === '' || fundSource === '') {
        alert('Mohon isi semua data wajib dengan benar.');
        return;
    }

    const newTransaction = {
        id: editingTransactionId || new Date().getTime().toString(),
        date,
        type,
        output,
        amount,
        paymentMethod,
        fundSource,
        fundSource,
        description,
        reminder: document.getElementById('enable-reminder').checked ? document.getElementById('reminder-time').value : null
    };

    // Prepare File
    const file = receiptEl.files[0];
    let fileBase64 = null;
    let fileMimeType = null;
    let fileName = null;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Menyimpan...';

    const sendData = async () => {
        try {
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: editingTransactionId ? 'edit' : 'add',
                    data: newTransaction,
                    fileBase64: fileBase64,
                    fileMimeType: fileMimeType,
                    fileName: fileName,
                    isReceiptDeleted: isReceiptDeleted
                }),
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                }
            });

            let result;
            const responseText = await response.text();
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                console.error('Raw response:', responseText);
                throw new Error('Respon server tidak valid. Pastikan Anda telah melakukan "New Deployment" pada Google Apps Script.');
            }

            if (result.status === 'success') {
                showToast(editingTransactionId ? 'Transaksi diperbarui!' : 'Transaksi ditambahkan!', 'success');
                const hadFileUpload = !!fileBase64;

                if (editingTransactionId) {
                    closeModal();
                    // Always refetch to be safe and ensure everything is in sync
                    await fetchTransactions();
                } else {
                    // New transaction: add optimistically, then refresh in background for receiptUrl
                    if (result.fileUrl) {
                        newTransaction.receiptUrl = result.fileUrl;
                    }
                    transactions.push({ ...newTransaction });
                    updateUI();
                    closeModal();
                    if (hadFileUpload) {
                        // Background refresh to sync receipt URL
                        fetchTransactions();
                    }
                }
            } else {
                throw new Error(result.message || 'Server gagal memproses permintaan.');
            }
        } catch (error) {
            console.error('Error detail:', error);
            alert('Error: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = "<i class='bx bx-plus-circle'></i> Simpan Transaksi";
        }
    };

    if (file) {
        try {
            const compressed = await compressImage(file);
            fileBase64 = compressed.base64;
            fileMimeType = compressed.mimeType;
            fileName = compressed.name;
            await sendData();
        } catch (error) {
            console.error('Compression error:', error);
            alert("Gagal memproses file foto.");
            submitBtn.disabled = false;
            submitBtn.innerHTML = "<i class='bx bx-plus-circle'></i> Simpan Transaksi";
        }
    } else {
        await sendData();
    }
};

// Edit transaction
window.editTransaction = (id) => {
    const transaction = transactions.find(t => t.id.toString() === id.toString());
    if (!transaction) {
        console.error("Transaction not found for ID:", id);
        return;
    }

    editingTransactionId = id;

    // Set date - handle both Date objects and strings safely
    if (transaction.date) {
        let dateStr = '';
        if (transaction.date instanceof Date) {
            // Date object: extract local year/month/day to avoid UTC shift
            const y = transaction.date.getFullYear();
            const m = String(transaction.date.getMonth() + 1).padStart(2, '0');
            const d = String(transaction.date.getDate()).padStart(2, '0');
            dateStr = `${y}-${m}-${d}`;
        } else {
            // Try to extract YYYY-MM-DD from string
            const raw = transaction.date.toString();
            // Check if it's already YYYY-MM-DD
            const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
                dateStr = isoMatch[0];
            } else {
                // Fallback: parse then format locally
                const parsed = new Date(raw);
                if (!isNaN(parsed)) {
                    const y = parsed.getFullYear();
                    const m = String(parsed.getMonth() + 1).padStart(2, '0');
                    const d = String(parsed.getDate()).padStart(2, '0');
                    dateStr = `${y}-${m}-${d}`;
                }
            }
        }
        dateEl.value = dateStr;
    }

    // Set other values
    document.querySelector(`input[name="type"][value="${transaction.type}"]`).checked = true;
    outputEl.value = transaction.output || '';
    amountEl.value = transaction.amount || '';
    paymentMethodEl.value = transaction.paymentMethod || '';
    fundSourceEl.value = transaction.fundSource || '';

    // Handle multiple items for description
    setSplitDescription(transaction.description);

    // Handle Reminder for editing
    const reminderCheckbox = document.getElementById('enable-reminder');
    const reminderSettings = document.getElementById('reminder-settings');
    const reminderTimeInput = document.getElementById('reminder-time');

    if (transaction.reminder && transaction.reminder !== "") {
        if (reminderCheckbox) reminderCheckbox.checked = true;
        if (reminderSettings) reminderSettings.style.display = 'block';
        if (reminderTimeInput) {
            // Convert any date format to datetime-local compatible string
            const rDate = new Date(transaction.reminder);
            if (!isNaN(rDate)) {
                const tzOffset = rDate.getTimezoneOffset() * 60000;
                const localISODate = new Date(rDate.getTime() - tzOffset).toISOString().slice(0, 16);
                reminderTimeInput.value = localISODate;
            }
        }
    }

    modalTitleEl.innerText = 'Edit Transaksi';

    // Receipt preview for editing
    if (transaction.receiptUrl && transaction.receiptUrl.startsWith('http')) {
        if (previewContainer) {
            previewContainer.style.display = 'block';
            const img = previewContainer.querySelector('img');
            if (img) img.src = transaction.receiptUrl;
            const label = document.getElementById('receipt-preview-label');
            if (label) label.innerText = 'Bukti saat ini';
        }
    } else {
        if (previewContainer) previewContainer.style.display = 'none';
    }

    modalEl.classList.add('active');
};

// Remove transaction
window.removeTransaction = async (id, btnElement) => {
    if (confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
        const originalBtnHTML = btnElement.innerHTML;
        btnElement.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";
        btnElement.disabled = true;

        try {
            await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'delete',
                    id: id.toString()
                }),
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                }
            });

            transactions = transactions.filter(transaction => transaction.id.toString() !== id.toString());
            updateUI();
            showToast('Transaksi berhasil dihapus', 'success');

            const viewModal = document.getElementById('view-modal-overlay');
            if (viewModal) viewModal.classList.remove('active');

        } catch (error) {
            console.error('Error deleting data:', error);
            alert('Gagal menghapus transaksi.');
            btnElement.innerHTML = originalBtnHTML;
            btnElement.disabled = false;
        }
    }
};

// Clear all transactions functionality removed as requested

const requestCloseModal = () => {
    const hasData = descriptionEl.value !== '' || amountEl.value !== '' || outputEl.value !== '' || paymentMethodEl.value !== '' || fundSourceEl.value !== '' || receiptEl.value !== '';

    if (hasData) {
        if (confirm('Apakah Anda yakin ingin membatalkan? Data yang belum disimpan akan hilang.')) {
            closeModal();
        }
    } else {
        closeModal();
    }
};

// Theme Management
const initTheme = () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        themeToggleBtn.innerHTML = "<i class='bx bx-sun'></i>";
    }
};

const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
        themeToggleBtn.innerHTML = "<i class='bx bx-sun'></i>";
    } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
        themeToggleBtn.innerHTML = "<i class='bx bx-moon'></i>";
    }
    showToast(`Mode ${currentTheme === 'dark' ? 'Terang' : 'Gelap'} aktif`, 'info');
};

const notificationBtn = document.getElementById('notification-btn');

// Event Listeners
formEl.addEventListener('submit', addTransaction);
openModalBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', requestCloseModal);
themeToggleBtn.addEventListener('click', toggleTheme);

// Reminder Toggle Listener
document.getElementById('enable-reminder')?.addEventListener('change', (e) => {
    document.getElementById('reminder-settings').style.display = e.target.checked ? 'block' : 'none';
});

// Reminder Presets and Info Logic
const reminderTimeInput = document.getElementById('reminder-time');
const reminderInfo = document.getElementById('reminder-info');

const updateReminderInfo = () => {
    if (!reminderTimeInput.value) {
        reminderInfo.style.display = 'none';
        return;
    }
    
    const rTime = new Date(reminderTimeInput.value);
    const now = new Date();
    const diffMs = rTime - now;
    
    if (diffMs <= 0) {
        reminderInfo.innerText = "Waktu sudah terlewat!";
        reminderInfo.style.color = "var(--expense-color)";
    } else {
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffHours / 24);
        
        let text = "Diingatkan pada: " + formatDate(rTime) + " jam " + rTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        if (diffDays > 0) text += ` (Dalam ${diffDays} hari)`;
        else if (diffHours > 0) text += ` (Dalam ${diffHours} jam)`;
        else text += ` (Sebentar lagi)`;
        
        reminderInfo.innerText = text;
        reminderInfo.style.color = "var(--accent-primary)";
    }
    reminderInfo.style.display = 'block';
};

reminderTimeInput?.addEventListener('input', updateReminderInfo);

document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.dataset.add;
        let date = new Date();
        
        if (type === '1h') date.setHours(date.getHours() + 1);
        else if (type === '3h') date.setHours(date.getHours() + 3);
        else if (type === 'tomorrow') {
            date.setDate(date.getDate() + 1);
            date.setHours(9, 0, 0, 0); // Tomorrow at 9 AM
        }
        else if (type === '1w') date.setDate(date.getDate() + 7);
        
        const tzOffset = date.getTimezoneOffset() * 60000;
        const localISODate = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
        reminderTimeInput.value = localISODate;
        updateReminderInfo();
    });
});

// Reminder Check System
const checkReminders = () => {
    const now = new Date().getTime();
    const lastChecked = localStorage.getItem('last_reminder_check') || 0;

    // Only check if it's been more than 1 minute since last check
    if (now - lastChecked < 60000) return;

    transactions.forEach(t => {
        if (t.reminder && t.reminder !== "") {
            const rTime = new Date(t.reminder).getTime();
            // If reminder time is between last check and now
            if (rTime > lastChecked && rTime <= now) {
                new Notification('Pengingat FinansialKu', {
                    body: `Waktunya: ${t.description} (${formatCurrency(t.amount)})`,
                    icon: 'https://cdn-icons-png.flaticon.com/512/2488/2488744.png'
                });
                showToast(`Pengingat: ${t.description}`, 'info');
            }
        }
    });

    localStorage.setItem('last_reminder_check', now);
};
if (notificationBtn) {
    notificationBtn.addEventListener('click', async () => {
        if (!('Notification' in window)) {
            showToast('Browser Anda tidak mendukung notifikasi', 'error');
            return;
        }

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            showToast('Notifikasi Aktif!', 'success');
            openReminderModal();
        } else if (permission === 'denied') {
            showToast('Izin diblokir. Klik ikon gembok di browser untuk mengizinkan.', 'error');
        } else {
            showToast('Izin notifikasi ditolak', 'error');
        }
    });
}

// Reminder List Modal Logic
const reminderListModal = document.getElementById('reminder-list-modal');
const closeReminderModalBtn = document.getElementById('close-reminder-modal');
const reminderListContainer = document.getElementById('reminder-list-container');

const openReminderModal = () => {
    renderReminderList();
    reminderListModal.classList.add('active');
};

const closeReminderModal = () => {
    reminderListModal.classList.remove('active');
};

if (closeReminderModalBtn) closeReminderModalBtn.addEventListener('click', closeReminderModal);
reminderListModal?.addEventListener('click', (e) => {
    if (e.target === reminderListModal) closeReminderModal();
});

const renderReminderList = () => {
    if (!reminderListContainer) return;
    
    // Ambil transaksi yang memiliki reminder
    const reminders = transactions
        .filter(t => t.reminder && t.reminder !== "")
        .sort((a, b) => new Date(a.reminder) - new Date(b.reminder));
    
    if (reminders.length === 0) {
        reminderListContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class='bx bx-bell-off' style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                <p>Tidak ada pengingat aktif.</p>
            </div>
        `;
        return;
    }
    
    const now = new Date();
    
    reminderListContainer.innerHTML = reminders.map(t => {
        const rTime = new Date(t.reminder);
        const isPassed = rTime < now;
        const statusText = isPassed ? "Sudah Terlewat" : "Akan Datang";
        const statusColor = isPassed ? "var(--expense-color)" : "var(--accent-primary)";
        
        return `
            <div class="card" style="margin-bottom: 0.75rem; padding: 1rem; border-left: 4px solid ${statusColor}; background: var(--item-bg);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div style="font-weight: 600; color: var(--text-main); font-size: 0.95rem;">${t.description || 'Tanpa Keterangan'}</div>
                    <span style="font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px; background: ${isPassed ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)'}; color: ${statusColor}; font-weight: 600; text-transform: uppercase;">
                        ${statusText}
                    </span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.5rem;">
                    <i class='bx bx-calendar-event'></i> ${formatDate(t.reminder)} jam ${rTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                    <i class='bx bx-money'></i> ${formatCurrency(t.amount)}
                </div>
                <button class="btn-clear" onclick="closeReminderModal(); viewTransaction('${t.id}')" style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--accent-primary); text-decoration: underline; padding: 0;">Lihat Transaksi</button>
            </div>
        `;
    }).join('');
};
modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) { requestCloseModal(); }
});

// File Preview Listener
const showReceiptPreview = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const previewImg = previewContainer.querySelector('img');
    const previewLabel = document.getElementById('receipt-preview-label');
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        if (previewLabel) previewLabel.innerText = editingTransactionId ? 'Foto baru (menggantikan yang lama)' : 'Foto terpilih';
        previewContainer.style.display = 'block';
        isReceiptDeleted = false;
    };
    reader.readAsDataURL(file);
};

receiptEl.addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
        showReceiptPreview(file);
    } else if (!isReceiptDeleted && !editingTransactionId) {
        previewContainer.style.display = 'none';
    }
});

// Remove Receipt Listener
removeReceiptBtn.addEventListener('click', function () {
    receiptEl.value = '';
    previewContainer.style.display = 'none';
    isReceiptDeleted = true;
});

// Run init
initTheme();
initTableEvents();
init().then(() => {
    // Check reminders after data is loaded
    setTimeout(checkReminders, 2000);
    // Periodically check every minute
    setInterval(checkReminders, 60000);
});
