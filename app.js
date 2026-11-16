// PKB Business Suite — Standalone Offline Invoice & Receipt Generator

const STORAGE_KEYS = {
    company: 'pkb_off_company',
    phone: 'pkb_off_phone',
    email: 'pkb_off_email',
    website: 'pkb_off_website',
    bank: 'pkb_off_bank',
    logo: 'pkb_off_logo',
    logoCleared: 'pkb_off_logo_cleared',
    signature: 'pkb_off_sig',
    currency: 'pkb_off_currency',
    invPrefix: 'pkb_off_inv_prefix',
    rcptPrefix: 'pkb_off_rcpt_prefix',
    invoices: 'pkb_off_invoices',
    receipts: 'pkb_off_receipts',
    invSeq: 'pkb_off_inv_seq',
    rcptSeq: 'pkb_off_rcpt_seq'
};

const PKB_DEFAULTS = {
    name: 'PeeKayBee Hospitality',
    phone: '09115054181',
    email: 'peekaybeehospitality@gmail.com',
    website: '',
    bank: 'Monie Point\n9115054181\nPeeKayBee Prime/Hospitality',
    currency: '₦|Naira|Kobo',
    invPrefix: 'INV-',
    rcptPrefix: 'RCT-'
};

function safeGetJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch {
        showToast('Storage full! Try using a smaller logo or export a backup.', 'error');
        return false;
    }
}

function getInitialLogo() {
    const savedLogo = localStorage.getItem(STORAGE_KEYS.logo);
    if (savedLogo) return savedLogo;
    if (localStorage.getItem(STORAGE_KEYS.logoCleared) === '1') return '';
    return window.PKB_DEFAULT_LOGO || '';
}

function getInitialField(storageKey, defaultVal) {
    const val = localStorage.getItem(storageKey);
    if (val === null) return defaultVal;
    return val;
}

const STATE = {
    currentTab: 'invoice',
    editingInvoiceId: null,
    editingReceiptId: null,
    company: {
        name: getInitialField(STORAGE_KEYS.company, PKB_DEFAULTS.name),
        phone: getInitialField(STORAGE_KEYS.phone, PKB_DEFAULTS.phone),
        email: getInitialField(STORAGE_KEYS.email, PKB_DEFAULTS.email),
        website: getInitialField(STORAGE_KEYS.website, PKB_DEFAULTS.website),
        bank: getInitialField(STORAGE_KEYS.bank, PKB_DEFAULTS.bank),
        logo: getInitialLogo(),
        signature: localStorage.getItem(STORAGE_KEYS.signature) || '',
        currency: localStorage.getItem(STORAGE_KEYS.currency) || PKB_DEFAULTS.currency,
        invPrefix: localStorage.getItem(STORAGE_KEYS.invPrefix) || PKB_DEFAULTS.invPrefix,
        rcptPrefix: localStorage.getItem(STORAGE_KEYS.rcptPrefix) || PKB_DEFAULTS.rcptPrefix
    },
    invoices: safeGetJSON(STORAGE_KEYS.invoices, []),
    receipts: safeGetJSON(STORAGE_KEYS.receipts, []),
    invSeq: parseInt(localStorage.getItem(STORAGE_KEYS.invSeq) || '1', 10) || 1,
    rcptSeq: parseInt(localStorage.getItem(STORAGE_KEYS.rcptSeq) || '1', 10) || 1,
    items: [
        { desc: '', price: 0, qty: 1 }
    ]
};

let sigPad = null;

document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker();
    initOfflineStatus();
    initTabNavigation();
    initCompanyProfile();
    initSignaturePad();
    initInvoiceBuilder();
    initReceiptBuilder();
    initHistoryControls();
    applyCurrencySymbols();
    renderHistory();
    updateInvoicePreview();
    updateReceiptPreview();
});

// Service Worker & Offline Indicator
function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
}

function initOfflineStatus() {
    const badge = document.getElementById('offline_badge');
    if (!badge) return;
    const update = () => {
        badge.textContent = navigator.onLine ? 'Offline Ready' : 'Offline Mode';
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast_container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3200);
}

// Currency Helpers
function getCurrencyParts() {
    const raw = STATE.company.currency || '₦|Naira|Kobo';
    const [symbol = '₦', major = 'Naira', minor = 'Kobo'] = raw.split('|');
    return { symbol, major, minor };
}

function applyCurrencySymbols() {
    const { symbol } = getCurrencyParts();
    document.querySelectorAll('.currency-symbol').forEach((el) => {
        el.textContent = symbol;
    });
}

// Navigation Handling
function initTabNavigation() {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });
}

function switchTab(tabName) {
    STATE.currentTab = tabName;
    document.body.dataset.activeTab = tabName;

    document.querySelectorAll('.nav-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === tabName);
    });

    const invView = document.getElementById('tab-invoice-view');
    const rcptView = document.getElementById('tab-receipt-view');
    const histView = document.getElementById('tab-history-view');
    const setView = document.getElementById('tab-settings-view');

    invView.style.display = tabName === 'invoice' ? 'flex' : 'none';
    rcptView.style.display = tabName === 'receipt' ? 'flex' : 'none';
    histView.style.display = tabName === 'history' ? 'block' : 'none';
    setView.style.display = tabName === 'settings' ? 'block' : 'none';

    invView.classList.toggle('active-view', tabName === 'invoice');
    rcptView.classList.toggle('active-view', tabName === 'receipt');

    if (tabName === 'history') {
        renderHistory();
    }
    if (tabName === 'settings') {
        resizeSignatureCanvas();
    }
}

// Company Profile & Settings
function initCompanyProfile() {
    const fields = [
        { id: 'co_name', key: 'name', storage: STORAGE_KEYS.company },
        { id: 'co_phone', key: 'phone', storage: STORAGE_KEYS.phone },
        { id: 'co_email', key: 'email', storage: STORAGE_KEYS.email },
        { id: 'co_website', key: 'website', storage: STORAGE_KEYS.website },
        { id: 'co_bank', key: 'bank', storage: STORAGE_KEYS.bank },
        { id: 'co_currency', key: 'currency', storage: STORAGE_KEYS.currency },
        { id: 'co_inv_prefix', key: 'invPrefix', storage: STORAGE_KEYS.invPrefix },
        { id: 'co_rcpt_prefix', key: 'rcptPrefix', storage: STORAGE_KEYS.rcptPrefix }
    ];

    fields.forEach(({ id, key, storage }) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = STATE.company[key] || '';

        if (!el.dataset.bound) {
            el.dataset.bound = '1';
            const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
            el.addEventListener(eventName, () => {
                STATE.company[key] = el.value;
                safeSetItem(storage, el.value);
                if (key === 'currency') {
                    applyCurrencySymbols();
                    syncReceiptWordsFromAmount();
                    renderItemsEditor();
                    renderHistory();
                }
                updateInvoicePreview();
                updateReceiptPreview();
            });
        }
    });

    updateSettingsLogoPreview();

    const logoInput = document.getElementById('logo_file_input');
    if (logoInput && !logoInput.dataset.bound) {
        logoInput.dataset.bound = '1';
        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            compressImageFile(file, 420, 220, (dataUrl) => {
                STATE.company.logo = dataUrl;
                localStorage.removeItem(STORAGE_KEYS.logoCleared);
                if (safeSetItem(STORAGE_KEYS.logo, dataUrl)) {
                    updateSettingsLogoPreview();
                    updateInvoicePreview();
                    updateReceiptPreview();
                    showToast('Business logo updated!', 'success');
                }
            });
            e.target.value = '';
        });
    }

    const usePkbLogoBtn = document.getElementById('btn_use_pkb_logo');
    if (usePkbLogoBtn && !usePkbLogoBtn.dataset.bound) {
        usePkbLogoBtn.dataset.bound = '1';
        usePkbLogoBtn.addEventListener('click', () => {
            STATE.company.logo = window.PKB_DEFAULT_LOGO || '';
            localStorage.removeItem(STORAGE_KEYS.logoCleared);
            if (STATE.company.logo) {
                safeSetItem(STORAGE_KEYS.logo, STATE.company.logo);
            }
            updateSettingsLogoPreview();
            updateInvoicePreview();
            updateReceiptPreview();
            showToast('PKB logo restored.', 'success');
        });
    }

    const removeLogoBtn = document.getElementById('btn_remove_logo');
    if (removeLogoBtn && !removeLogoBtn.dataset.bound) {
        removeLogoBtn.dataset.bound = '1';
        removeLogoBtn.addEventListener('click', () => {
            STATE.company.logo = '';
            localStorage.removeItem(STORAGE_KEYS.logo);
            safeSetItem(STORAGE_KEYS.logoCleared, '1');
            updateSettingsLogoPreview();
            updateInvoicePreview();
            updateReceiptPreview();
            showToast('Logo removed.');
        });
    }

    const restorePkbBtn = document.getElementById('btn_restore_pkb_defaults');
    if (restorePkbBtn && !restorePkbBtn.dataset.bound) {
        restorePkbBtn.dataset.bound = '1';
        restorePkbBtn.addEventListener('click', () => {
            Object.assign(STATE.company, PKB_DEFAULTS, {
                logo: window.PKB_DEFAULT_LOGO || ''
            });
            localStorage.removeItem(STORAGE_KEYS.logoCleared);
            safeSetItem(STORAGE_KEYS.company, STATE.company.name);
            safeSetItem(STORAGE_KEYS.phone, STATE.company.phone);
            safeSetItem(STORAGE_KEYS.email, STATE.company.email);
            safeSetItem(STORAGE_KEYS.website, STATE.company.website);
            safeSetItem(STORAGE_KEYS.bank, STATE.company.bank);
            safeSetItem(STORAGE_KEYS.currency, STATE.company.currency);
            safeSetItem(STORAGE_KEYS.invPrefix, STATE.company.invPrefix);
            safeSetItem(STORAGE_KEYS.rcptPrefix, STATE.company.rcptPrefix);
            if (STATE.company.logo) safeSetItem(STORAGE_KEYS.logo, STATE.company.logo);

            initCompanyProfile();
            applyCurrencySymbols();
            updateInvoicePreview();
            updateReceiptPreview();
            showToast('Restored PeeKayBee Hospitality defaults.', 'success');
        });
    }

    const clearCompanyBtn = document.getElementById('btn_clear_company_profile');
    if (clearCompanyBtn && !clearCompanyBtn.dataset.bound) {
        clearCompanyBtn.dataset.bound = '1';
        clearCompanyBtn.addEventListener('click', () => {
            if (!confirm('Clear company name, bank details, logo, and signature on this device so you can enter another company\'s info?')) {
                return;
            }
            STATE.company.name = '';
            STATE.company.phone = '';
            STATE.company.email = '';
            STATE.company.website = '';
            STATE.company.bank = '';
            STATE.company.logo = '';
            STATE.company.signature = '';

            safeSetItem(STORAGE_KEYS.company, '');
            safeSetItem(STORAGE_KEYS.phone, '');
            safeSetItem(STORAGE_KEYS.email, '');
            safeSetItem(STORAGE_KEYS.website, '');
            safeSetItem(STORAGE_KEYS.bank, '');
            localStorage.removeItem(STORAGE_KEYS.logo);
            safeSetItem(STORAGE_KEYS.logoCleared, '1');
            localStorage.removeItem(STORAGE_KEYS.signature);

            if (sigPad) sigPad.clear();
            const statusEl = document.getElementById('sig_status_text');
            if (statusEl) statusEl.textContent = 'No signature saved';

            initCompanyProfile();
            updateInvoicePreview();
            updateReceiptPreview();
            showToast('Cleared! Enter your company details & upload your logo.');
        });
    }
}

function updateSettingsLogoPreview() {
    const img = document.getElementById('settings_logo_preview');
    const empty = document.getElementById('settings_logo_empty');
    if (!img || !empty) return;
    if (STATE.company.logo) {
        img.src = STATE.company.logo;
        img.style.display = 'block';
        empty.style.display = 'none';
    } else {
        img.style.display = 'none';
        empty.style.display = 'inline';
    }
}

function compressImageFile(file, maxW, maxH, callback) {
    const reader = new FileReader();
    reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => {
            let w = img.width;
            let h = img.height;
            const ratio = Math.min(maxW / w, maxH / h, 1);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);

            const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            callback(canvas.toDataURL(mime, 0.88));
        };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
}

// Signature Pad Setup
function initSignaturePad() {
    const canvas = document.getElementById('signature_canvas');
    if (!canvas || !window.SignaturePad) return;

    sigPad = new window.SignaturePad(canvas, {
        backgroundColor: 'rgba(255, 255, 255, 0)',
        penColor: '#000080'
    });

    const statusEl = document.getElementById('sig_status_text');
    if (statusEl) {
        statusEl.textContent = STATE.company.signature ? 'Signature saved & active' : 'No signature saved';
    }

    document.getElementById('btn_clear_sig')?.addEventListener('click', () => {
        sigPad.clear();
        STATE.company.signature = '';
        localStorage.removeItem(STORAGE_KEYS.signature);
        if (statusEl) statusEl.textContent = 'Signature cleared';
        updateInvoicePreview();
        updateReceiptPreview();
        showToast('Signature cleared.');
    });

    document.getElementById('btn_save_sig')?.addEventListener('click', () => {
        if (sigPad.isEmpty()) {
            showToast('Please draw your signature first.', 'error');
            return;
        }
        const dataUrl = sigPad.toDataURL('image/png');
        STATE.company.signature = dataUrl;
        if (safeSetItem(STORAGE_KEYS.signature, dataUrl)) {
            if (statusEl) statusEl.textContent = 'Signature saved & active';
            updateInvoicePreview();
            updateReceiptPreview();
            showToast('Signature saved!', 'success');
        }
    });

    const sigFileInput = document.getElementById('sig_file_input');
    if (sigFileInput) {
        sigFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            compressImageFile(file, 360, 140, (dataUrl) => {
                STATE.company.signature = dataUrl;
                if (safeSetItem(STORAGE_KEYS.signature, dataUrl)) {
                    if (statusEl) statusEl.textContent = 'Signature image uploaded & active';
                    updateInvoicePreview();
                    updateReceiptPreview();
                    showToast('Signature uploaded!', 'success');
                }
            });
            e.target.value = '';
        });
    }

    window.addEventListener('resize', () => {
        if (STATE.currentTab === 'settings') {
            resizeSignatureCanvas();
        }
    });
}

function resizeSignatureCanvas() {
    const canvas = document.getElementById('signature_canvas');
    if (!canvas || !sigPad) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    canvas.getContext('2d').scale(ratio, ratio);
    sigPad.clear();
}

// Sequence Number Helpers
function getNextNumber(prefix, seq, existingList) {
    let candidateSeq = seq;
    let candidate = `${prefix}${String(candidateSeq).padStart(4, '0')}`;
    const existingNumbers = new Set(existingList.map((r) => r.number));
    while (existingNumbers.has(candidate)) {
        candidateSeq += 1;
        candidate = `${prefix}${String(candidateSeq).padStart(4, '0')}`;
    }
    return { number: candidate, seq: candidateSeq };
}

function todayISO() {
    return new Date().toISOString().split('T')[0];
}

// Invoice Builder
function initInvoiceBuilder() {
    resetInvoiceForm(false);

    const invInputs = [
        'inv_no', 'inv_status', 'inv_date', 'inv_due_date',
        'inv_client', 'inv_client_contact', 'inv_client_addr',
        'inv_discount', 'inv_tax', 'inv_del', 'inv_notes'
    ];
    invInputs.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const evt = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(evt, updateInvoicePreview);
    });

    document.getElementById('btn_add_item')?.addEventListener('click', () => {
        STATE.items.push({ desc: '', price: 0, qty: 1 });
        renderItemsEditor();
        updateInvoicePreview();
    });

    document.getElementById('btn_new_invoice')?.addEventListener('click', () => {
        resetInvoiceForm(true);
    });
}

function resetInvoiceForm(notify = false) {
    STATE.editingInvoiceId = null;
    const next = getNextNumber(STATE.company.invPrefix, STATE.invSeq, STATE.invoices);
    document.getElementById('inv_no').value = next.number;
    document.getElementById('inv_status').value = 'Unpaid';
    document.getElementById('inv_date').value = todayISO();
    document.getElementById('inv_due_date').value = '';
    document.getElementById('inv_client').value = '';
    document.getElementById('inv_client_contact').value = '';
    document.getElementById('inv_client_addr').value = '';
    document.getElementById('inv_discount').value = 0;
    document.getElementById('inv_tax').value = 0;
    document.getElementById('inv_del').value = 0;
    document.getElementById('inv_notes').value = '';
    STATE.items = [{ desc: '', price: 0, qty: 1 }];
    renderItemsEditor();
    updateInvoicePreview();
    if (notify) showToast(`Started new invoice ${next.number}`);
}

function renderItemsEditor() {
    const container = document.getElementById('items_editor');
    if (!container) return;
    container.innerHTML = '';
    const { symbol } = getCurrencyParts();

    STATE.items.forEach((item, index) => {
        const lineTotal = (parseFloat(item.price) || 0) * (parseFloat(item.qty) || 0);
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
            <button type="button" class="item-row-remove" title="Remove item" onclick="window.removeItem(${index})">&times;</button>
            <div class="form-group" style="margin-bottom:6px;">
                <input type="text" placeholder="Item / Service Description" value="${escapeHtml(item.desc)}" oninput="window.updateItem(${index}, 'desc', this.value)">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Price (${escapeHtml(symbol)})</label>
                    <input type="number" min="0" step="any" value="${item.price}" oninput="window.updateItem(${index}, 'price', this.value)">
                </div>
                <div class="form-group">
                    <label>Qty</label>
                    <input type="number" min="0" step="any" value="${item.qty}" oninput="window.updateItem(${index}, 'qty', this.value)">
                </div>
            </div>
            <div class="item-line-total">Line Total: <strong>${escapeHtml(symbol)}<span id="item_line_total_${index}">${formatMoney(lineTotal)}</span></strong></div>
        `;
        container.appendChild(row);
    });
}

function updateItem(index, key, val) {
    if (!STATE.items[index]) return;
    if (key === 'price' || key === 'qty') {
        STATE.items[index][key] = parseFloat(val) || 0;
        const lineEl = document.getElementById(`item_line_total_${index}`);
        if (lineEl) {
            const lineTotal = (STATE.items[index].price || 0) * (STATE.items[index].qty || 0);
            lineEl.textContent = formatMoney(lineTotal);
        }
    } else {
        STATE.items[index][key] = val;
    }
    updateInvoicePreview();
}

function removeItem(index) {
    if (STATE.items.length <= 1) {
        STATE.items[0] = { desc: '', price: 0, qty: 1 };
    } else {
        STATE.items.splice(index, 1);
    }
    renderItemsEditor();
    updateInvoicePreview();
}

function calculateInvoiceTotals() {
    let subtotal = 0;
    STATE.items.forEach((i) => {
        subtotal += (parseFloat(i.price) || 0) * (parseFloat(i.qty) || 0);
    });
    const discount = Math.max(0, parseFloat(document.getElementById('inv_discount')?.value || 0) || 0);
    const taxableBase = Math.max(0, subtotal - discount);
    const taxRate = Math.max(0, parseFloat(document.getElementById('inv_tax')?.value || 0) || 0);
    const delivery = Math.max(0, parseFloat(document.getElementById('inv_del')?.value || 0) || 0);
    const taxVal = taxableBase * (taxRate / 100);
    const grandTotal = taxableBase + taxVal + delivery;
    return { subtotal, discount, taxRate, taxVal, delivery, grandTotal };
}

function updateInvoicePreview() {
    const { symbol } = getCurrencyParts();

    document.getElementById('out_inv_sender').textContent = STATE.company.name || 'Your Business Name';
    const contactParts = [STATE.company.phone, STATE.company.email].filter(Boolean);
    document.getElementById('out_inv_contact').textContent = contactParts.join(' | ');

    const bankBox = document.getElementById('out_inv_bank_box');
    const bankEl = document.getElementById('out_inv_bank');
    if ((STATE.company.bank || '').trim()) {
        bankEl.textContent = STATE.company.bank;
        bankBox.style.visibility = 'visible';
    } else {
        bankEl.textContent = '';
        bankBox.style.visibility = 'hidden';
    }

    const logoImg = document.getElementById('out_inv_logo');
    if (STATE.company.logo) {
        logoImg.src = STATE.company.logo;
        logoImg.style.display = 'block';
    } else {
        logoImg.style.display = 'none';
    }

    const sigBlock = document.getElementById('out_inv_sig_block');
    const sigImg = document.getElementById('out_inv_sig_img');
    if (STATE.company.signature) {
        sigImg.src = STATE.company.signature;
        sigBlock.style.display = 'block';
    } else {
        sigBlock.style.display = 'none';
    }

    document.getElementById('out_inv_no').textContent = document.getElementById('inv_no').value || 'INV-0001';

    const status = document.getElementById('inv_status').value || 'Unpaid';
    const statusBadge = document.getElementById('out_inv_status_badge');
    statusBadge.textContent = status.toUpperCase();
    statusBadge.className = `doc-status-badge status-${status.toLowerCase()}`;

    document.getElementById('out_inv_date').textContent = document.getElementById('inv_date').value || '';
    const dueDate = document.getElementById('inv_due_date').value;
    const dueRow = document.getElementById('out_inv_due_row');
    if (dueDate) {
        document.getElementById('out_inv_due_date').textContent = dueDate;
        dueRow.style.display = 'block';
    } else {
        dueRow.style.display = 'none';
    }

    document.getElementById('out_inv_client').textContent = document.getElementById('inv_client').value || 'Client Name';
    document.getElementById('out_inv_client_contact').textContent = document.getElementById('inv_client_contact').value || '';
    document.getElementById('out_inv_client_addr').textContent = document.getElementById('inv_client_addr').value || '';

    const tbody = document.getElementById('out_inv_tbody');
    tbody.innerHTML = '';
    STATE.items.forEach((i) => {
        const lineTotal = (parseFloat(i.price) || 0) * (parseFloat(i.qty) || 0);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(i.desc || 'Item')}</td>
            <td style="text-align:right;">${escapeHtml(symbol)}${formatMoney(i.price)}</td>
            <td style="text-align:right;">${parseFloat(i.qty) || 0}</td>
            <td style="text-align:right; font-weight:700;">${escapeHtml(symbol)}${formatMoney(lineTotal)}</td>
        `;
        tbody.appendChild(tr);
    });

    const totals = calculateInvoiceTotals();
    document.getElementById('out_inv_sub').textContent = formatMoney(totals.subtotal);

    const discRow = document.getElementById('out_inv_disc_row');
    discRow.style.display = totals.discount > 0 ? 'table-row' : 'none';
    document.getElementById('out_inv_disc_val').textContent = formatMoney(totals.discount);

    document.getElementById('out_inv_tax_rate').textContent = totals.taxRate;
    document.getElementById('out_inv_tax_val').textContent = formatMoney(totals.taxVal);
    document.getElementById('out_inv_del_val').textContent = formatMoney(totals.delivery);
    document.getElementById('out_inv_total').textContent = formatMoney(totals.grandTotal);

    const notes = document.getElementById('inv_notes').value.trim();
    const notesBox = document.getElementById('out_inv_notes_box');
    if (notes) {
        document.getElementById('out_inv_notes').textContent = notes;
        notesBox.style.display = 'block';
    } else {
        notesBox.style.display = 'none';
    }
}

// Receipt Builder
function initReceiptBuilder() {
    resetReceiptForm(false);

    const rcptInputs = ['rcpt_no', 'rcpt_date', 'rcpt_from', 'rcpt_desc', 'rcpt_amt', 'rcpt_method', 'rcpt_words', 'rcpt_bal'];
    rcptInputs.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const evt = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(evt, () => {
            if (id === 'rcpt_amt') {
                syncReceiptWordsFromAmount();
            }
            updateReceiptPreview();
        });
    });

    document.getElementById('btn_new_receipt')?.addEventListener('click', () => {
        resetReceiptForm(true);
    });
}

function syncReceiptWordsFromAmount() {
    const amt = parseFloat(document.getElementById('rcpt_amt')?.value || 0) || 0;
    const wordsEl = document.getElementById('rcpt_words');
    if (wordsEl) {
        wordsEl.value = amountToWords(amt);
    }
}

function resetReceiptForm(notify = false) {
    STATE.editingReceiptId = null;
    const next = getNextNumber(STATE.company.rcptPrefix, STATE.rcptSeq, STATE.receipts);
    document.getElementById('rcpt_no').value = next.number;
    document.getElementById('rcpt_date').value = todayISO();
    document.getElementById('rcpt_from').value = '';
    document.getElementById('rcpt_desc').value = '';
    document.getElementById('rcpt_amt').value = 0;
    document.getElementById('rcpt_method').value = 'Transfer';
    document.getElementById('rcpt_words').value = amountToWords(0);
    document.getElementById('rcpt_bal').value = 0;
    updateReceiptPreview();
    if (notify) showToast(`Started new receipt ${next.number}`);
}

function updateReceiptPreview() {
    document.getElementById('out_rcpt_sender').textContent = STATE.company.name || 'Your Business Name';
    const contactParts = [STATE.company.phone, STATE.company.email].filter(Boolean);
    document.getElementById('out_rcpt_contact').textContent = contactParts.join(' | ');

    const logoImg = document.getElementById('out_rcpt_logo');
    if (STATE.company.logo) {
        logoImg.src = STATE.company.logo;
        logoImg.style.display = 'block';
    } else {
        logoImg.style.display = 'none';
    }

    const sigBlock = document.getElementById('out_rcpt_sig_block');
    const sigImg = document.getElementById('out_rcpt_sig_img');
    if (STATE.company.signature) {
        sigImg.src = STATE.company.signature;
        sigBlock.style.display = 'block';
    } else {
        sigBlock.style.display = 'none';
    }

    document.getElementById('out_rcpt_no').textContent = document.getElementById('rcpt_no').value || 'RCT-0001';
    document.getElementById('out_rcpt_date').textContent = document.getElementById('rcpt_date').value || '';
    document.getElementById('out_rcpt_method').textContent = document.getElementById('rcpt_method').value || 'Transfer';
    document.getElementById('out_rcpt_from').textContent = document.getElementById('rcpt_from').value || 'Client Name';
    document.getElementById('out_rcpt_desc').textContent = document.getElementById('rcpt_desc').value || 'Service / Product Description';
    document.getElementById('out_rcpt_words').textContent = document.getElementById('rcpt_words').value || amountToWords(0);

    const amt = parseFloat(document.getElementById('rcpt_amt').value || 0) || 0;
    const bal = parseFloat(document.getElementById('rcpt_bal').value || 0) || 0;
    document.getElementById('out_rcpt_amt').textContent = formatMoney(amt);
    document.getElementById('out_rcpt_bal').textContent = formatMoney(bal);
}

// Save, Print & PDF Export
function persistInvoice() {
    const invNo = (document.getElementById('inv_no').value || '').trim() || 'INV-0001';
    const totals = calculateInvoiceTotals();
    const recordId = STATE.editingInvoiceId || Date.now();

    const invData = {
        id: recordId,
        type: 'Invoice',
        number: invNo,
        status: document.getElementById('inv_status').value || 'Unpaid',
        date: document.getElementById('inv_date').value,
        dueDate: document.getElementById('inv_due_date').value,
        client: document.getElementById('inv_client').value,
        clientContact: document.getElementById('inv_client_contact').value,
        clientAddr: document.getElementById('inv_client_addr').value,
        items: JSON.parse(JSON.stringify(STATE.items)),
        discount: document.getElementById('inv_discount').value || 0,
        tax: document.getElementById('inv_tax').value || 0,
        delivery: document.getElementById('inv_del').value || 0,
        notes: document.getElementById('inv_notes').value || '',
        bank: STATE.company.bank,
        numericAmount: totals.grandTotal,
        amount: formatMoney(totals.grandTotal)
    };

    const existingIdx = STATE.invoices.findIndex((i) => i.id === recordId);
    if (existingIdx >= 0) {
        STATE.invoices[existingIdx] = invData;
    } else {
        STATE.invoices.push(invData);
        STATE.invSeq += 1;
        safeSetItem(STORAGE_KEYS.invSeq, String(STATE.invSeq));
    }

    STATE.editingInvoiceId = recordId;
    safeSetItem(STORAGE_KEYS.invoices, JSON.stringify(STATE.invoices));
    updateInvoicePreview();
    renderHistory();
    return invData;
}

function persistReceipt() {
    const rcptNo = (document.getElementById('rcpt_no').value || '').trim() || 'RCT-0001';
    const amt = parseFloat(document.getElementById('rcpt_amt').value || 0) || 0;
    const recordId = STATE.editingReceiptId || Date.now();

    const rcptData = {
        id: recordId,
        type: 'Receipt',
        number: rcptNo,
        date: document.getElementById('rcpt_date').value,
        from: document.getElementById('rcpt_from').value,
        desc: document.getElementById('rcpt_desc').value,
        amt: amt,
        method: document.getElementById('rcpt_method').value,
        words: document.getElementById('rcpt_words').value,
        bal: document.getElementById('rcpt_bal').value || 0,
        client: document.getElementById('rcpt_from').value,
        numericAmount: amt,
        amount: formatMoney(amt)
    };

    const existingIdx = STATE.receipts.findIndex((r) => r.id === recordId);
    if (existingIdx >= 0) {
        STATE.receipts[existingIdx] = rcptData;
    } else {
        STATE.receipts.push(rcptData);
        STATE.rcptSeq += 1;
        safeSetItem(STORAGE_KEYS.rcptSeq, String(STATE.rcptSeq));
    }

    STATE.editingReceiptId = recordId;
    safeSetItem(STORAGE_KEYS.receipts, JSON.stringify(STATE.receipts));
    updateReceiptPreview();
    renderHistory();
    return rcptData;
}

function saveInvoiceOnly() {
    const rec = persistInvoice();
    showToast(`Saved ${rec.number} to History.`, 'success');
}

function saveReceiptOnly() {
    const rec = persistReceipt();
    showToast(`Saved ${rec.number} to History.`, 'success');
}

function saveAndPrintInvoice() {
    switchTab('invoice');
    persistInvoice();
    printDocumentTitleSafe();
}

function saveAndPrintReceipt() {
    switchTab('receipt');
    persistReceipt();
    printDocumentTitleSafe();
}

function printDocumentTitleSafe() {
    const originalTitle = document.title;
    document.title = '';
    window.print();
    document.title = originalTitle;
}

function downloadInvoicePDF() {
    switchTab('invoice');
    const rec = persistInvoice();
    exportElementToPDF('paper_invoice', `${rec.number}.pdf`);
}

function downloadReceiptPDF() {
    switchTab('receipt');
    const rec = persistReceipt();
    exportElementToPDF('paper_receipt', `${rec.number}.pdf`);
}

function exportElementToPDF(elementId, filename) {
    const element = document.getElementById(elementId);
    if (!element) return;

    if (window.html2pdf) {
        const opt = {
            margin: [6, 5, 6, 5],
            filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        window.html2pdf().set(opt).from(element).save();
        showToast(`Downloading ${filename}...`, 'success');
    } else {
        printDocumentTitleSafe();
    }
}

// History, Search, Filter & Backup
function initHistoryControls() {
    document.getElementById('history_search')?.addEventListener('input', renderHistory);
    document.getElementById('history_filter')?.addEventListener('change', renderHistory);

    const importInput = document.getElementById('import_backup_input');
    if (importInput) {
        importInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = JSON.parse(evt.target.result);
                    importBackupData(data);
                } catch {
                    showToast('Invalid backup JSON file.', 'error');
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        });
    }
}

function parseNumericAmount(rec) {
    if (typeof rec.numericAmount === 'number') return rec.numericAmount;
    return parseFloat(String(rec.amount || '0').replace(/,/g, '')) || 0;
}

function renderHistory() {
    const { symbol } = getCurrencyParts();
    const totalCount = STATE.invoices.length + STATE.receipts.length;
    const badge = document.getElementById('history_count_badge');
    if (badge) badge.textContent = String(totalCount);

    const invTotal = STATE.invoices.reduce((sum, r) => sum + parseNumericAmount(r), 0);
    const rcptTotal = STATE.receipts.reduce((sum, r) => sum + parseNumericAmount(r), 0);
    document.getElementById('stat_inv_count').textContent = String(STATE.invoices.length);
    document.getElementById('stat_rcpt_count').textContent = String(STATE.receipts.length);
    document.getElementById('stat_inv_total').textContent = `${symbol}${formatMoney(invTotal)}`;
    document.getElementById('stat_rcpt_total').textContent = `${symbol}${formatMoney(rcptTotal)}`;

    const tbody = document.getElementById('history_tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const search = (document.getElementById('history_search')?.value || '').trim().toLowerCase();
    const filter = document.getElementById('history_filter')?.value || 'all';

    let allRecords = [...STATE.invoices, ...STATE.receipts].sort((a, b) => b.id - a.id);

    if (filter !== 'all') {
        allRecords = allRecords.filter((r) => r.type === filter);
    }
    if (search) {
        allRecords = allRecords.filter((r) => {
            const haystack = [r.number, r.client, r.from, r.desc, r.date].join(' ').toLowerCase();
            return haystack.includes(search);
        });
    }

    if (allRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:24px;">No matching records found.</td></tr>';
        return;
    }

    allRecords.forEach((rec) => {
        const tr = document.createElement('tr');
        const convertBtn = rec.type === 'Invoice'
            ? `<button class="btn btn-secondary btn-sm" onclick="window.convertInvoiceToReceipt(${rec.id})" title="Create Receipt from this Invoice">🧾 Receipt</button>`
            : '';

        tr.innerHTML = `
            <td><span class="badge-tag" style="background:${rec.type === 'Invoice' ? '#000080' : '#10b981'}">${escapeHtml(rec.type)}</span></td>
            <td><strong>${escapeHtml(rec.number)}</strong></td>
            <td>${escapeHtml(rec.date || '-')}</td>
            <td>${escapeHtml(rec.client || rec.from || '-')}</td>
            <td><strong>${escapeHtml(symbol)}${escapeHtml(rec.amount)}</strong></td>
            <td style="text-align:right;">
                <div style="display:flex; gap:6px; justify-content:flex-end; flex-wrap:wrap;">
                    <button class="btn btn-secondary btn-sm" onclick="window.loadRecord(${rec.id}, '${rec.type}', false)">✏️ Edit</button>
                    <button class="btn btn-secondary btn-sm" onclick="window.loadRecord(${rec.id}, '${rec.type}', true)">📄 Duplicate</button>
                    ${convertBtn}
                    <button class="btn btn-primary btn-sm" onclick="window.printRecord(${rec.id}, '${rec.type}')">🖨️</button>
                    <button class="btn btn-success btn-sm" onclick="window.downloadRecordPDF(${rec.id}, '${rec.type}')">📥 PDF</button>
                    <button class="btn btn-danger btn-sm" onclick="window.deleteRecord(${rec.id}, '${rec.type}')">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function loadRecord(id, type, asDuplicate = false) {
    if (type === 'Invoice') {
        const item = STATE.invoices.find((i) => i.id === id);
        if (!item) return;

        if (asDuplicate) {
            STATE.editingInvoiceId = null;
            const next = getNextNumber(STATE.company.invPrefix, STATE.invSeq, STATE.invoices);
            document.getElementById('inv_no').value = next.number;
            document.getElementById('inv_date').value = todayISO();
            showToast(`Duplicated as ${next.number}`);
        } else {
            STATE.editingInvoiceId = item.id;
            document.getElementById('inv_no').value = item.number || '';
            document.getElementById('inv_date').value = item.date || '';
        }

        document.getElementById('inv_status').value = item.status || 'Unpaid';
        document.getElementById('inv_due_date').value = item.dueDate || '';
        document.getElementById('inv_client').value = item.client || '';
        document.getElementById('inv_client_contact').value = item.clientContact || '';
        document.getElementById('inv_client_addr').value = item.clientAddr || '';
        document.getElementById('inv_discount').value = item.discount || 0;
        document.getElementById('inv_tax').value = item.tax || 0;
        document.getElementById('inv_del').value = item.delivery || 0;
        document.getElementById('inv_notes').value = item.notes || '';

        if (Array.isArray(item.items) && item.items.length > 0) {
            STATE.items = JSON.parse(JSON.stringify(item.items));
        } else {
            STATE.items = [{ desc: 'Invoice Item', price: parseNumericAmount(item), qty: 1 }];
        }

        renderItemsEditor();
        updateInvoicePreview();
        switchTab('invoice');
    } else {
        const item = STATE.receipts.find((r) => r.id === id);
        if (!item) return;

        if (asDuplicate) {
            STATE.editingReceiptId = null;
            const next = getNextNumber(STATE.company.rcptPrefix, STATE.rcptSeq, STATE.receipts);
            document.getElementById('rcpt_no').value = next.number;
            document.getElementById('rcpt_date').value = todayISO();
            showToast(`Duplicated as ${next.number}`);
        } else {
            STATE.editingReceiptId = item.id;
            document.getElementById('rcpt_no').value = item.number || '';
            document.getElementById('rcpt_date').value = item.date || '';
        }

        const amt = item.amt !== undefined ? item.amt : parseNumericAmount(item);
        document.getElementById('rcpt_from').value = item.from || item.client || '';
        document.getElementById('rcpt_desc').value = item.desc || '';
        document.getElementById('rcpt_amt').value = amt;
        document.getElementById('rcpt_method').value = item.method || 'Transfer';
        document.getElementById('rcpt_words').value = item.words || amountToWords(parseFloat(amt) || 0);
        document.getElementById('rcpt_bal').value = item.bal || 0;

        updateReceiptPreview();
        switchTab('receipt');
    }
}

function convertInvoiceToReceipt(invoiceId) {
    const inv = STATE.invoices.find((i) => i.id === invoiceId);
    if (!inv) return;

    STATE.editingReceiptId = null;
    const next = getNextNumber(STATE.company.rcptPrefix, STATE.rcptSeq, STATE.receipts);
    const total = parseNumericAmount(inv);

    document.getElementById('rcpt_no').value = next.number;
    document.getElementById('rcpt_date').value = todayISO();
    document.getElementById('rcpt_from').value = inv.client || '';
    document.getElementById('rcpt_desc').value = `Payment for Invoice ${inv.number}`;
    document.getElementById('rcpt_amt').value = total;
    document.getElementById('rcpt_method').value = 'Transfer';
    document.getElementById('rcpt_words').value = amountToWords(total);
    document.getElementById('rcpt_bal').value = 0;

    updateReceiptPreview();
    switchTab('receipt');
    showToast(`Pre-filled Receipt ${next.number} from ${inv.number}`, 'success');
}

function printRecord(id, type) {
    loadRecord(id, type, false);
    setTimeout(() => {
        printDocumentTitleSafe();
    }, 100);
}

function downloadRecordPDF(id, type) {
    loadRecord(id, type, false);
    setTimeout(() => {
        if (type === 'Invoice') {
            exportElementToPDF('paper_invoice', `${document.getElementById('inv_no').value || 'Invoice'}.pdf`);
        } else {
            exportElementToPDF('paper_receipt', `${document.getElementById('rcpt_no').value || 'Receipt'}.pdf`);
        }
    }, 100);
}

function deleteRecord(id, type) {
    if (!confirm(`Delete this ${type.toLowerCase()} from history? This cannot be undone.`)) {
        return;
    }
    if (type === 'Invoice') {
        STATE.invoices = STATE.invoices.filter((i) => i.id !== id);
        safeSetItem(STORAGE_KEYS.invoices, JSON.stringify(STATE.invoices));
        if (STATE.editingInvoiceId === id) STATE.editingInvoiceId = null;
    } else {
        STATE.receipts = STATE.receipts.filter((r) => r.id !== id);
        safeSetItem(STORAGE_KEYS.receipts, JSON.stringify(STATE.receipts));
        if (STATE.editingReceiptId === id) STATE.editingReceiptId = null;
    }
    renderHistory();
    showToast(`${type} deleted.`);
}

// Backup & CSV Export
function exportBackupJSON() {
    const payload = {
        version: 3,
        exportedAt: new Date().toISOString(),
        company: STATE.company,
        invSeq: STATE.invSeq,
        rcptSeq: STATE.rcptSeq,
        invoices: STATE.invoices,
        receipts: STATE.receipts
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `pkb-suite-backup-${todayISO()}.json`);
    showToast('Backup exported!', 'success');
}

function importBackupData(data) {
    if (!data || (!Array.isArray(data.invoices) && !Array.isArray(data.receipts))) {
        showToast('Backup file has no valid records.', 'error');
        return;
    }
    if (!confirm('Import this backup? Existing records will be kept and merged with the backup.')) {
        return;
    }

    if (data.company && typeof data.company === 'object') {
        Object.assign(STATE.company, data.company);
        safeSetItem(STORAGE_KEYS.company, STATE.company.name || '');
        safeSetItem(STORAGE_KEYS.phone, STATE.company.phone || '');
        safeSetItem(STORAGE_KEYS.email, STATE.company.email || '');
        safeSetItem(STORAGE_KEYS.website, STATE.company.website || '');
        safeSetItem(STORAGE_KEYS.bank, STATE.company.bank || '');
        safeSetItem(STORAGE_KEYS.currency, STATE.company.currency || '₦|Naira|Kobo');
        safeSetItem(STORAGE_KEYS.invPrefix, STATE.company.invPrefix || 'INV-');
        safeSetItem(STORAGE_KEYS.rcptPrefix, STATE.company.rcptPrefix || 'RCT-');
        if (STATE.company.logo) safeSetItem(STORAGE_KEYS.logo, STATE.company.logo);
        if (STATE.company.signature) safeSetItem(STORAGE_KEYS.signature, STATE.company.signature);
    }

    const existingInvIds = new Set(STATE.invoices.map((i) => i.id));
    (data.invoices || []).forEach((inv) => {
        if (!existingInvIds.has(inv.id)) STATE.invoices.push(inv);
    });

    const existingRcptIds = new Set(STATE.receipts.map((r) => r.id));
    (data.receipts || []).forEach((rcpt) => {
        if (!existingRcptIds.has(rcpt.id)) STATE.receipts.push(rcpt);
    });

    if (typeof data.invSeq === 'number') STATE.invSeq = Math.max(STATE.invSeq, data.invSeq);
    if (typeof data.rcptSeq === 'number') STATE.rcptSeq = Math.max(STATE.rcptSeq, data.rcptSeq);

    safeSetItem(STORAGE_KEYS.invoices, JSON.stringify(STATE.invoices));
    safeSetItem(STORAGE_KEYS.receipts, JSON.stringify(STATE.receipts));
    safeSetItem(STORAGE_KEYS.invSeq, String(STATE.invSeq));
    safeSetItem(STORAGE_KEYS.rcptSeq, String(STATE.rcptSeq));

    initCompanyProfile();
    applyCurrencySymbols();
    updateInvoicePreview();
    updateReceiptPreview();
    renderHistory();
    showToast('Backup imported successfully!', 'success');
}

function exportHistoryCSV() {
    const allRecords = [...STATE.invoices, ...STATE.receipts].sort((a, b) => b.id - a.id);
    if (allRecords.length === 0) {
        showToast('No records to export.', 'error');
        return;
    }
    const headers = ['Type', 'Number', 'Date', 'Client/Payer', 'Status/Method', 'Amount'];
    const rows = allRecords.map((r) => [
        r.type,
        r.number,
        r.date || '',
        r.client || r.from || '',
        r.type === 'Invoice' ? (r.status || 'Unpaid') : (r.method || ''),
        parseNumericAmount(r).toFixed(2)
    ]);

    const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `pkb-history-${todayISO()}.csv`);
    showToast('CSV exported!', 'success');
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// Utility Functions
function formatMoney(num) {
    return (parseFloat(num) || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function numberToWords(n) {
    const words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convert(num) {
        if (num < 20) return words[num];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + words[num % 10] : '');
        if (num < 1000) return words[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + convert(num % 100) : '');
        if (num < 1000000) return convert(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + convert(num % 1000) : '');
        if (num < 1000000000) return convert(Math.floor(num / 1000000)) + ' Million' + (num % 1000000 ? ' ' + convert(num % 1000000) : '');
        if (num < 1000000000000) return convert(Math.floor(num / 1000000000)) + ' Billion' + (num % 1000000000 ? ' ' + convert(num % 1000000000) : '');
        return num.toString();
    }

    const val = Math.floor(Math.abs(n));
    return val === 0 ? 'Zero' : convert(val);
}

function amountToWords(amount) {
    const { major, minor } = getCurrencyParts();
    const abs = Math.abs(parseFloat(amount) || 0);
    const whole = Math.floor(abs);
    const cents = Math.round((abs - whole) * 100);

    if (cents > 0) {
        return `${numberToWords(whole)} ${major}, ${numberToWords(cents)} ${minor} Only`;
    }
    return `${numberToWords(whole)} ${major} Only`;
}

// Global window bindings
window.loadRecord = loadRecord;
window.convertInvoiceToReceipt = convertInvoiceToReceipt;
window.printRecord = printRecord;
window.downloadRecordPDF = downloadRecordPDF;
window.deleteRecord = deleteRecord;
window.saveInvoiceOnly = saveInvoiceOnly;
window.saveReceiptOnly = saveReceiptOnly;
window.saveAndPrintInvoice = saveAndPrintInvoice;
window.saveAndPrintReceipt = saveAndPrintReceipt;
window.downloadInvoicePDF = downloadInvoicePDF;
window.downloadReceiptPDF = downloadReceiptPDF;
window.exportBackupJSON = exportBackupJSON;
window.exportHistoryCSV = exportHistoryCSV;
window.removeItem = removeItem;
window.updateItem = updateItem;
window.switchTab = switchTab;
