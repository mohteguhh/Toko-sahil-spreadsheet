/* ==========================================================================
   KASIRKILAT POS LOGIC - FULL FEATURES & BATCH OPTIMIZATIONS
   ========================================================================== */

// --- State Aplikasi ---
let products = [];
let shifts = [];
let activeShift = null; // null jika tidak ada shift aktif
let customers = [];
let loyaltySettings = JSON.parse(localStorage.getItem('kasir_loyalty_settings')) || {
  pointsPerRp: 50000,
  rpPerPoint: 100
};

// --- Helper Gambar Offline (Flicker-Free) ---
function handleImageError(img) {
  img.onerror = null; // Mencegah loop tak terbatas
  img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="%23cbd5e1" stroke-width="2"><rect width="100" height="100" fill="%23f8fafc"/><circle cx="50" cy="45" r="15"/><path d="M20,80 C20,60 80,60 80,80"/></svg>';
}
let cart = JSON.parse(localStorage.getItem('kasir_active_cart')) || [];
let heldCarts = JSON.parse(localStorage.getItem('kasir_held_carts')) || [];
let transactions = []; // Riwayat transaksi lokal untuk analisis
let categories = ['All'];
let activeTab = 'pos'; // Default active tab
let activeCategory = 'All';

// State Pencarian POS
let filteredProducts = [];
let selectedFloatIndex = -1;

// State Pencarian Kulak
let kulakFilteredProducts = [];
let selectedKulakFloatIndex = -1;

// State Kamera Scanner
let html5QrcodeScanner = null;

// State Pemilihan Tombol Cetak Nota
let selectedReceiptButtonIndex = 0; // 0 = Cetak Nota, 1 = Tidak
let currentTxForPrint = null;
let currentItemsForPrint = [];

// State Cetak Label Harga Massal (Terpilih)
let selectedProductIds = new Set();

// State Kasir & Multi-user (Fitur Baru)
let cashiers = JSON.parse(localStorage.getItem('kasir_cashiers')) || ['Kasir Utama', 'Kasir Shift 2', 'Kasir Shift 3'];
let activeCashier = localStorage.getItem('kasir_active_cashier') || 'Kasir Utama';

// URL Google Apps Script & Offline Sync
let gasUrl = localStorage.getItem('kasir_gas_url') || '';
let syncStatus = 'offline'; 
let offlineQueue = JSON.parse(localStorage.getItem('kasir_offline_queue')) || [];

// Pengaturan Sistem Aplikasi
let appConfig = JSON.parse(localStorage.getItem('kasir_app_config')) || {
  strictShift: false,
  allowZeroStock: false,
  customerMode: true,
  enablePromo: true
};
if (appConfig.enablePromo === undefined) appConfig.enablePromo = true;

// Pengaturan Nota / Struk Toko (Default)
let receiptSettings = JSON.parse(localStorage.getItem('kasir_receipt_settings')) || {
  logo: '',
  name: 'KasirKilat',
  phone: '0812-3456-7890',
  address: 'Jl. Utama No. 123, Indonesia',
  fontSizeHeader: 14,
  fontSizeItems: 12,
  fontSizeFooter: 12
};
// Kompatibilitas mundur
if (receiptSettings.showLogo === undefined) receiptSettings.showLogo = true;
if (receiptSettings.showName === undefined) receiptSettings.showName = true;
if (receiptSettings.showAddress === undefined) receiptSettings.showAddress = true;
if (receiptSettings.showPhone === undefined) receiptSettings.showPhone = true;
if (receiptSettings.showCashier === undefined) receiptSettings.showCashier = true;
if (receiptSettings.showSubtotal === undefined) receiptSettings.showSubtotal = true;
if (receiptSettings.showDiscount === undefined) receiptSettings.showDiscount = true;
if (receiptSettings.showMethod === undefined) receiptSettings.showMethod = true;
if (receiptSettings.fontSizeHeader === undefined) receiptSettings.fontSizeHeader = receiptSettings.fontSize || 14;
if (receiptSettings.fontSizeItems === undefined) receiptSettings.fontSizeItems = receiptSettings.fontSize || 12;
if (receiptSettings.fontSizeFooter === undefined) receiptSettings.fontSizeFooter = receiptSettings.fontSize || 12;

// Contoh Data Awal (Produk)
const defaultProducts = [
  { 
    id: "P001", 
    nama: "Kopi Hitam", 
    kategori: "Minuman", 
    harga_beli: 3000, 
    harga_jual: 5000, 
    stok: 50, 
    barcode: "8996001300124", 
    gambar: "https://m.media-amazon.com/images/I/71Bs3RzmTyL._SL1500_.jpg",
    tanggal_kadaluarsa: "2027-12-31"
  },
  { 
    id: "P002", 
    nama: "Teh Manis", 
    kategori: "Minuman", 
    harga_beli: 2000, 
    harga_jual: 4000, 
    stok: 1, 
    barcode: "8996001300247", 
    gambar: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=300",
    tanggal_kadaluarsa: ""
  },
  { 
    id: "P003", 
    nama: "Roti Bakar Cokelat", 
    kategori: "Makanan", 
    harga_beli: 8000, 
    harga_jual: 12000, 
    stok: 30, 
    barcode: "", 
    gambar: "https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?q=80&w=300",
    tanggal_kadaluarsa: "2026-07-05" // Contoh produk mendekati kadaluarsa
  }
];

// Contoh Data Awal (Transaksi 7 Hari Terakhir untuk visualisasi chart awal)
const seedTransactions = () => {
  const list = [];
  const now = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    // Berikan transaksi acak
    const totalTx = Math.floor(Math.random() * 5) + 1;
    for (let t = 0; t < totalTx; t++) {
      const itemsCount = Math.floor(Math.random() * 2) + 1;
      const txItems = [];
      let total = 0;
      
      for (let j = 0; j < itemsCount; j++) {
        const p = defaultProducts[Math.floor(Math.random() * defaultProducts.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        txItems.push({
          id: p.id,
          nama: p.nama,
          harga: p.harga_jual,
          harga_beli: p.harga_beli,
          qty: qty
        });
        total += p.harga_jual * qty;
      }
      
      list.push({
        id: 'TX-' + date.getTime().toString().slice(-6) + t,
        waktu: date.toISOString(),
        items: txItems,
        total: total,
        bayar: total + 5000,
        kembalian: 5000
      });
    }
  }
  return list;
};

// --- Inisialisasi Aplikasi ---
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  loadAppConfig();
  loadReceiptSettings();
  loadData();
  initCashiers();
  
  // Isi input URL di pengaturan jika sudah ada
  if (gasUrl) {
    document.getElementById('gas-url-input').value = gasUrl;
    
    // Sinkronisasi otomatis jika perangkat online saat halaman dibuka
    if (navigator.onLine) {
      processOfflineQueue();
      syncFromCloud();
      syncTransactionsFromCloud();
    } else {
      updateSyncStatus('offline', `Offline (${offlineQueue.length} transaksi tertunda)`);
      initAnalyticsFilter();
      updateAnalytics();
    }
  } else {
    updateSyncStatus('offline', 'Belum Terhubung');
    initAnalyticsFilter();
    updateAnalytics();
  }
  
  // Event listener untuk memicu sinkronisasi otomatis ketika laptop beralih dari offline ke online
  window.addEventListener('online', () => {
    console.log("Koneksi internet terdeteksi aktif. Memulai sinkronisasi otomatis ke cloud...");
    if (gasUrl) {
      processOfflineQueue().then(() => {
        syncFromCloud();
        syncTransactionsFromCloud();
      });
    }
  });

  // Sinkronisasi otomatis saat pengguna kembali membuka tab/aplikasi (sangat berguna di HP)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine && gasUrl) {
      console.log("Aplikasi kembali aktif, menyinkronkan data dari cloud...");
      processOfflineQueue().then(() => {
        syncFromCloud();
        syncTransactionsFromCloud();
      });
    }
  });

  // Sinkronisasi background berkala setiap 5 menit jika aplikasi dibiarkan menyala terus
  setInterval(() => {
    if (navigator.onLine && gasUrl) {
      processOfflineQueue().then(() => {
        syncFromCloud();
        syncTransactionsFromCloud();
      });
    }
  }, 5 * 60 * 1000);
  
  // Event listeners
  window.addEventListener('keydown', handleGlobalKeydowns);
  
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('keydown', handleSearchInputKeydowns);
  
  const kulakSearchInput = document.getElementById('kulak-search-input');
  kulakSearchInput.addEventListener('keydown', handleKulakSearchInputKeydowns);
  
  const editTxSearchInput = document.getElementById('edit-tx-search-input');
  if (editTxSearchInput) {
    editTxSearchInput.addEventListener('keydown', handleEditTxSearchInputKeydowns);
  }
  
  const prodBarcode = document.getElementById('prod-barcode');
  if (prodBarcode) {
    prodBarcode.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const expiryInput = document.getElementById('prod-expiry');
        if (expiryInput) expiryInput.focus();
      }
    });
  }
  
  // Tutup dropdown melayang saat klik di luar
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar')) {
      closeFloatingResults();
      closeKulakFloatingResults();
      closeEditTxFloatingResults();
    }
    

  });
  
  // Deteksi event cetak untuk toggle body class
  window.addEventListener('beforeprint', () => {
    const receiptModal = document.getElementById('receipt-modal');
    if (receiptModal && receiptModal.classList.contains('active')) {
      document.body.classList.add('printing-receipt');
    }
  });
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing-receipt');
    document.body.classList.remove('printing-daily-report');
  });
});

// Timer Jam
function initClock() {
  const timeDisplay = document.getElementById('time-display');
  setInterval(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
    timeDisplay.textContent = timeStr;
  }, 1000);
}

// Muat data dari LocalStorage
function loadData() {
  const cachedProducts = localStorage.getItem('kasir_products');
  if (cachedProducts) {
    products = JSON.parse(cachedProducts);
  } else {
    products = [...defaultProducts];
    saveProductsLocally();
  }
  
  const cachedTransactions = localStorage.getItem('kasir_transactions');
  if (cachedTransactions) {
    transactions = JSON.parse(cachedTransactions);
  } else {
    transactions = seedTransactions();
    localStorage.setItem('kasir_transactions', JSON.stringify(transactions));
  }
  
  const cachedShifts = localStorage.getItem('kasir_shifts');
  if (cachedShifts) shifts = JSON.parse(cachedShifts);
  
  const cachedActiveShift = localStorage.getItem('kasir_active_shift');
  if (cachedActiveShift) activeShift = JSON.parse(cachedActiveShift);
  
  const cachedCustomers = localStorage.getItem('kasir_customers');
  if (cachedCustomers) customers = JSON.parse(cachedCustomers);
  
  updateCategoriesList();
  
  // Update Shift UI on load
  if (typeof updateShiftStatusUI === 'function') {
    updateShiftStatusUI();
  }
  
  if (typeof renderCustomersTable === 'function') {
    renderCustomersTable();
  }
  
  if (typeof checkPromoBanner === 'function') {
    checkPromoBanner();
  }
  
  // Set UI inputs for Loyalty
  const ptsInput = document.getElementById('setting-points-per-rp');
  const rpInput = document.getElementById('setting-rp-per-point');
  if (ptsInput) ptsInput.value = loyaltySettings.pointsPerRp;
  if (rpInput) rpInput.value = loyaltySettings.rpPerPoint;
}

// Simpan data produk secara lokal
function saveProductsLocally() {
  localStorage.setItem('kasir_products', JSON.stringify(products));
}

// Update daftar kategori unik
function updateCategoriesList() {
  const cats = products.map(p => p.kategori || 'Umum');
  categories = ['All', ...new Set(cats)];
}

// --- PENGATURAN NOTA & REBRANDING NAVBAR ---
function loadReceiptSettings() {
  // Update UI Pengaturan
  document.getElementById('store-name-input').value = receiptSettings.name;
  document.getElementById('store-phone-input').value = receiptSettings.phone;
  document.getElementById('store-address-input').value = receiptSettings.address;
  
  document.getElementById('receipt-font-header').value = receiptSettings.fontSizeHeader;
  document.getElementById('font-preview-header-val').textContent = `${receiptSettings.fontSizeHeader}px`;
  document.getElementById('receipt-font-items').value = receiptSettings.fontSizeItems;
  document.getElementById('font-preview-items-val').textContent = `${receiptSettings.fontSizeItems}px`;
  document.getElementById('receipt-font-footer').value = receiptSettings.fontSizeFooter;
  document.getElementById('font-preview-footer-val').textContent = `${receiptSettings.fontSizeFooter}px`;
  
  document.getElementById('chk-show-logo').checked = receiptSettings.showLogo;
  document.getElementById('chk-show-name').checked = receiptSettings.showName;
  document.getElementById('chk-show-address').checked = receiptSettings.showAddress;
  document.getElementById('chk-show-phone').checked = receiptSettings.showPhone;
  document.getElementById('chk-show-cashier').checked = receiptSettings.showCashier;
  document.getElementById('chk-show-subtotal').checked = receiptSettings.showSubtotal;
  document.getElementById('chk-show-discount').checked = receiptSettings.showDiscount;
  document.getElementById('chk-show-method').checked = receiptSettings.showMethod;
  
  applyReceiptSettings();
}

function updateFontPreview(type, val) {
  document.getElementById(`font-preview-${type}-val`).textContent = `${val}px`;
}

function saveAppConfig() {
  appConfig.strictShift = document.getElementById('chk-strict-shift').checked;
  appConfig.allowZeroStock = document.getElementById('chk-allow-zero-stock').checked;
  appConfig.customerMode = document.getElementById('chk-customer-mode').checked;
  appConfig.enablePromo = document.getElementById('chk-enable-promo').checked;
  localStorage.setItem('kasir_app_config', JSON.stringify(appConfig));
  
  const promoContainer = document.getElementById('promo-fields-container');
  if (promoContainer) {
    promoContainer.style.display = appConfig.enablePromo ? 'grid' : 'none';
  }
  
  alert('Pengaturan Sistem Aplikasi berhasil disimpan!');
}

function loadAppConfig() {
  document.getElementById('chk-strict-shift').checked = appConfig.strictShift;
  document.getElementById('chk-allow-zero-stock').checked = appConfig.allowZeroStock;
  document.getElementById('chk-customer-mode').checked = appConfig.customerMode;
  document.getElementById('chk-enable-promo').checked = appConfig.enablePromo;
  
  const promoContainer = document.getElementById('promo-fields-container');
  if (promoContainer) {
    promoContainer.style.display = appConfig.enablePromo ? 'grid' : 'none';
  }
}

function applyReceiptSettings() {
  // 1. Rebranding Navbar Atas (Nama Toko & Logo)
  const storeNameEl = document.getElementById('app-store-name');
  storeNameEl.textContent = receiptSettings.name;
  
  const logoContainer = document.getElementById('app-logo-container');
  if (receiptSettings.logo) {
    logoContainer.innerHTML = `<img src="${receiptSettings.logo}" alt="Logo" class="navbar-logo-img">`;
  } else {
    // Kembali ke SVG Default
    logoContainer.innerHTML = `
      <svg class="icon-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
      </svg>
    `;
  }
  
  // 2. Rebranding Struk Nota
  document.getElementById('rec-store-name').textContent = receiptSettings.name;
  document.getElementById('rec-store-address').textContent = receiptSettings.address;
  document.getElementById('rec-store-phone').textContent = `Telp: ${receiptSettings.phone}`;
  
  document.getElementById('rec-store-name').style.display = receiptSettings.showName ? 'block' : 'none';
  document.getElementById('rec-store-address').style.display = receiptSettings.showAddress ? 'block' : 'none';
  document.getElementById('rec-store-phone').style.display = receiptSettings.showPhone ? 'block' : 'none';
  
  const cashierRow = document.getElementById('rec-cashier-row');
  if (cashierRow) {
    cashierRow.style.display = receiptSettings.showCashier ? 'flex' : 'none';
  }
  
  const recLogoContainer = document.getElementById('rec-logo-container');
  if (receiptSettings.logo && receiptSettings.showLogo) {
    recLogoContainer.innerHTML = `<img src="${receiptSettings.logo}" alt="Logo" class="receipt-logo-img">`;
    recLogoContainer.style.display = 'block';
  } else {
    recLogoContainer.innerHTML = '';
    recLogoContainer.style.display = 'none';
  }
  
  // 3. Atur Font Size di Struk Cetak
  const receiptCard = document.getElementById('receipt-card-print');
  
  const receiptHeader = receiptCard.querySelector('.receipt-header');
  if (receiptHeader) receiptHeader.style.fontSize = `${receiptSettings.fontSizeHeader}px`;
  
  const receiptItems = receiptCard.querySelector('.receipt-items');
  if (receiptItems) receiptItems.style.fontSize = `${receiptSettings.fontSizeItems}px`;
  
  const receiptTotals = receiptCard.querySelector('.receipt-totals');
  if (receiptTotals) receiptTotals.style.fontSize = `${receiptSettings.fontSizeFooter}px`;
  
  // Sembunyikan Subtotal, Diskon, Metode
  const subtotalRow = document.getElementById('rec-subtotal-row');
  if (subtotalRow) subtotalRow.style.display = receiptSettings.showSubtotal ? 'flex' : 'none';
  
  const discountRow = document.getElementById('rec-discount-row');
  if (discountRow) discountRow.style.display = receiptSettings.showDiscount ? 'flex' : 'none';
  
  const methodRow = document.getElementById('rec-method-row');
  if (methodRow) methodRow.style.display = receiptSettings.showMethod ? 'flex' : 'none';
  
  // 4. Update logo preview box di pengaturan
  const previewBox = document.getElementById('logo-preview-box');
  if (receiptSettings.logo) {
    previewBox.innerHTML = `<img src="${receiptSettings.logo}" alt="Logo Preview">`;
  } else {
    previewBox.innerHTML = `<span>Belum ada Logo</span>`;
  }
}

// Memicu klik input file untuk logo
function triggerLogoUpload() {
  document.getElementById('logo-file-input').click();
}

// Konversi berkas gambar ke Base64 (Offline-Safe)
function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    receiptSettings.logo = e.target.result;
    
    // Update preview box langsung
    const previewBox = document.getElementById('logo-preview-box');
    previewBox.innerHTML = `<img src="${receiptSettings.logo}" alt="Logo Preview">`;
  };
  reader.readAsDataURL(file);
}

function updateReceiptFontSizePreview(val) {
  document.getElementById('font-size-preview-val').textContent = `${val}px`;
}

function saveReceiptSettings() {
  receiptSettings.name = document.getElementById('store-name-input').value.trim() || 'KasirKilat';
  receiptSettings.phone = document.getElementById('store-phone-input').value.trim() || '-';
  receiptSettings.address = document.getElementById('store-address-input').value.trim() || '-';
  
  receiptSettings.fontSizeHeader = parseInt(document.getElementById('receipt-font-header').value) || 14;
  receiptSettings.fontSizeItems = parseInt(document.getElementById('receipt-font-items').value) || 12;
  receiptSettings.fontSizeFooter = parseInt(document.getElementById('receipt-font-footer').value) || 12;
  
  receiptSettings.showLogo = document.getElementById('chk-show-logo').checked;
  receiptSettings.showName = document.getElementById('chk-show-name').checked;
  receiptSettings.showAddress = document.getElementById('chk-show-address').checked;
  receiptSettings.showPhone = document.getElementById('chk-show-phone').checked;
  receiptSettings.showCashier = document.getElementById('chk-show-cashier').checked;
  receiptSettings.showSubtotal = document.getElementById('chk-show-subtotal').checked;
  receiptSettings.showDiscount = document.getElementById('chk-show-discount').checked;
  receiptSettings.showMethod = document.getElementById('chk-show-method').checked;
  
  localStorage.setItem('kasir_receipt_settings', JSON.stringify(receiptSettings));
  applyReceiptSettings();
  alert('Pengaturan Branding & Nota berhasil disimpan!');
}

// --- NAVIGASI TAB ---
function switchTab(tabName) {
  activeTab = tabName;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById(`tab-${tabName}`).classList.add('active');
  
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  document.getElementById(`pane-${tabName}`).classList.add('active');
  
  // Aksi tab
  if (tabName === 'pos') {
    closeFloatingResults();
    document.getElementById('search-input').value = '';
    renderCart();
    focusSearchInput();
  } else if (tabName === 'products') {
    document.getElementById('product-list-search').value = '';
    renderProductsTable();
    resetProductForm();
  } else if (tabName === 'analytics') {
    initAnalyticsFilter();
    updateAnalytics();
  } else if (tabName === 'kulak') {
    closeKulakForm();
    focusKulakSearch();
  } else if (tabName === 'transactions') {
    document.getElementById('transaction-list-search').value = '';
    renderTransactionsTable();
    closeEditTransactionModal();
  }
}

// Fokuskan kursor ke input kasir
function focusSearchInput() {
  setTimeout(() => {
    const input = document.getElementById('search-input');
    if (input && activeTab === 'pos') {
      input.focus();
      input.select();
    }
  }, 50);
}

// Fokuskan kursor ke input Kulak
function focusKulakSearch() {
  setTimeout(() => {
    const input = document.getElementById('kulak-search-input');
    if (input && activeTab === 'kulak') {
      input.focus();
      input.select();
    }
  }, 50);
}

// --- SINKRONISASI & API ---
function updateSyncStatus(status, text) {
  syncStatus = status;
  const statusEl = document.getElementById('sync-status');
  const textEl = document.getElementById('sync-text');
  if (statusEl && textEl) {
    statusEl.className = 'sync-status ' + status;
    textEl.textContent = text;
  }
}

// --- KOMUNIKASI API GOOGLE APPS SCRIPT (CORS-Safe & dengan Timeout) ---
async function fetchFromGAS(action, postData = null) {
  if (!gasUrl) {
    return { status: 'offline', message: 'URL API belum disetel.' };
  }

  // Setel timeout 30 detik karena spreadsheet dengan data besar butuh waktu memuat di Google
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 30000); 

  try {
    let response;
    if (postData) {
      response = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({ action, ...postData }),
        signal: controller.signal
      });
    } else {
      const preventCacheUrl = `${gasUrl}?action=${action}&_t=${Date.now()}`;
      response = await fetch(preventCacheUrl, {
        signal: controller.signal
      });
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Kesalahan koneksi ke Google Sheets:", error);
    
    let errMsg = error.toString();
    if (error.name === 'AbortError') {
      errMsg = "Koneksi Timeout (Batas waktu 30 detik terlampaui). Spreadsheet Anda memiliki data yang cukup besar, coba gunakan local server.";
    }
    return { status: 'error', message: errMsg };
  }
}

// Fungsi syncTransactionsFromCloud ada di bawah (baris ~2987) agar field piutang tidak hilang


// Parsing daftar item string "Teh Manis (2x @4000)" kembali ke objek
function parseTransactionItemsString(itemsStr) {
  if (!itemsStr) return [];
  const list = [];
  const parts = itemsStr.split(", ");
  
  parts.forEach(part => {
    // Regex mencocokkan format: Nama Barang (Qtyx @Harga)
    const match = part.match(/(.+) \((\d+)x @(\d+)\)/);
    if (match) {
      const nama = match[1].trim();
      const qty = parseInt(match[2]) || 1;
      const harga = parseFloat(match[3]) || 0;
      
      // Lookup harga beli di database lokal saat ini
      const prod = products.find(p => p.nama.toLowerCase() === nama.toLowerCase());
      const harga_beli = prod ? prod.harga_beli : Math.round(harga * 0.7); // estimasi jika data produk terhapus
      
      list.push({
        id: prod ? prod.id : '',
        nama: nama,
        harga: harga,
        harga_beli: harga_beli,
        qty: qty
      });
    }
  });
  return list;
}

// --- TAB 1: MODUL ANALISIS PENJUALAN ---

// Inisialisasi filter analisis (hari ini by default)
function initAnalyticsFilter() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const thisMonth = todayStr.slice(0, 7); // YYYY-MM
  const thisYear = now.getFullYear();
  
  // Set default date filter to today
  const dateInput = document.getElementById('analytics-filter-date');
  if (dateInput && !dateInput.value) dateInput.value = todayStr;
  
  const monthInput = document.getElementById('analytics-filter-month');
  if (monthInput && !monthInput.value) monthInput.value = thisMonth;
  
  // Populate year dropdown from transaction years + current year
  const yearSelect = document.getElementById('analytics-filter-year');
  if (yearSelect) {
    const years = new Set([thisYear]);
    transactions.forEach(tx => {
      if (tx.waktu) years.add(parseInt(tx.waktu.slice(0, 4)));
    });
    const sortedYears = [...years].sort((a, b) => b - a);
    yearSelect.innerHTML = sortedYears.map(y => 
      `<option value="${y}" ${y === thisYear ? 'selected' : ''}>${y}</option>`
    ).join('');
  }
}

function onAnalyticsFilterTypeChange() {
  const filterType = document.getElementById('analytics-filter-type').value;
  document.getElementById('analytics-filter-date-wrap').style.display = filterType === 'hari' ? 'flex' : 'none';
  document.getElementById('analytics-filter-month-wrap').style.display = filterType === 'bulan' ? 'flex' : 'none';
  document.getElementById('analytics-filter-year-wrap').style.display = filterType === 'tahun' ? 'flex' : 'none';
  updateAnalytics();
}

function getAnalyticsFilteredTxs() {
  const filterType = document.getElementById('analytics-filter-type')?.value || 'hari';
  if (filterType === 'hari') {
    const dateVal = document.getElementById('analytics-filter-date')?.value || new Date().toISOString().slice(0, 10);
    return transactions.filter(tx => tx.waktu && tx.waktu.slice(0, 10) === dateVal);
  } else if (filterType === 'bulan') {
    const monthVal = document.getElementById('analytics-filter-month')?.value || new Date().toISOString().slice(0, 7);
    return transactions.filter(tx => tx.waktu && tx.waktu.slice(0, 7) === monthVal);
  } else if (filterType === 'tahun') {
    const yearVal = document.getElementById('analytics-filter-year')?.value || String(new Date().getFullYear());
    return transactions.filter(tx => tx.waktu && tx.waktu.slice(0, 4) === yearVal);
  } else {
    return [...transactions];
  }
}

function updateAnalytics() {
  const now = new Date();
  
  // Filter transaksi sesuai filter yang dipilih
  const todayTxs = getAnalyticsFilteredTxs();
  
  let revenue = 0;
  let netProfit = 0;
  
  // Rincian Metode Pembayaran Hari Ini
  const methodsBreakdown = {
    'Tunai': 0,
    'QRIS': 0,
    'Debit': 0,
    'Transfer': 0
  };
  
  // Metode non-tunai: uang tidak langsung masuk laci (hanya laba bersih dihitung ke stat revenue)
  const nonCashMethods = ['QRIS', 'Transfer', 'Debit'];
  
  todayTxs.forEach(tx => {
    const metode = tx.metode_pembayaran || 'Tunai';
    const isNonCash = nonCashMethods.includes(metode);
    
    // Hitung Laba Bersih sebelum diskon transaksi
    let txSubtotal = 0;
    let txNetProfitBeforeDiscount = 0;
    tx.items.forEach(item => {
      const buyPrice = item.harga_beli || 0;
      const sellPrice = item.harga || 0;
      txNetProfitBeforeDiscount += (sellPrice - buyPrice) * item.qty;
      txSubtotal += sellPrice * item.qty;
    });
    
    // Kurangi laba bersih dengan diskon transaksi
    const txDiscount = Math.max(0, txSubtotal - tx.total);
    const txNetProfit = txNetProfitBeforeDiscount - txDiscount;
    netProfit += txNetProfit;
    
    // Omset/revenue hanya dari transaksi tunai (non-cash tidak masuk laci)
    if (!isNonCash) {
      revenue += tx.total;
    }
    
    // Akumulasi metode pembayaran
    methodsBreakdown[metode] = (methodsBreakdown[metode] || 0) + tx.total;
  });
  
  // Hitung total piutang aktif secara kumulatif (semua transaksi belum lunas)
  let totalDebt = 0;
  transactions.forEach(tx => {
    totalDebt += (tx.sisa_piutang || 0);
  });
  
  // Total Penjualan = Omset (tunai) - Laba Bersih = HPP/Harga Pokok
  const totalPenjualan = revenue - netProfit;
  
  // Update Metrik Hari Ini di UI
  document.getElementById('stat-revenue').textContent = `Rp ${formatRupiah(revenue)}`;
  document.getElementById('stat-gross-profit').textContent = `Rp ${formatRupiah(totalPenjualan)}`;
  document.getElementById('stat-net-profit').textContent = `Rp ${formatRupiah(netProfit)}`;
  
  const statDebtEl = document.getElementById('stat-debt');
  if (statDebtEl) {
    statDebtEl.textContent = `Rp ${formatRupiah(totalDebt)}`;
  }
  
  // Render rincian metode pembayaran di panel kanan
  const breakdownContainer = document.getElementById('payment-method-breakdown');
  if (breakdownContainer) {
    breakdownContainer.innerHTML = '';
    Object.keys(methodsBreakdown).forEach(m => {
      const amt = methodsBreakdown[m];
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.justify = 'space-between';
      div.style.alignItems = 'center';
      div.style.padding = '0.35rem 0.5rem';
      div.style.backgroundColor = 'var(--bg-body)';
      div.style.borderRadius = 'var(--border-radius-sm)';
      div.style.fontSize = '0.85rem';
      div.innerHTML = `
        <span style="font-weight:600; color:var(--text-main);">${m}</span>
        <span style="font-weight:700; color:var(--text-main);">Rp ${formatRupiah(amt)}</span>
      `;
      breakdownContainer.appendChild(div);
    });
  }
  
  // 1. Hitung Stok Menipis (0 s.d. 2 pcs)
  const stockAlerts = products.filter(p => p.stok <= 2);
  const stockListEl = document.getElementById('stock-alerts-list');
  stockListEl.innerHTML = '';
  
  if (stockAlerts.length === 0) {
    stockListEl.innerHTML = '<li class="empty-alert">Stok aman terkendali.</li>';
  } else {
    stockAlerts.forEach(p => {
      const li = document.createElement('li');
      li.className = 'alert-item';
      li.innerHTML = `
        <div class="alert-item-left">
          <span class="alert-item-name">${p.nama} (${p.id})</span>
          <span class="alert-item-meta">Kategori: ${p.kategori || 'Umum'}</span>
        </div>
        <span class="alert-item-badge ${p.stok === 0 ? '' : 'warning'}">${p.stok === 0 ? 'Habis' : p.stok + ' pcs'}</span>
      `;
      stockListEl.appendChild(li);
    });
  }
  
  // 2. Hitung Produk Kadaluarsa dalam 30 hari
  const expAlertsList = document.getElementById('expiry-alerts-list');
  expAlertsList.innerHTML = '';
  const upcomingExpiry = [];
  
  products.forEach(p => {
    if (p.tanggal_kadaluarsa) {
      const expDate = new Date(p.tanggal_kadaluarsa);
      const diffTime = expDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Jika kadaluarsa kurang dari 30 hari (bisa bernilai negatif jika sudah lewat)
      if (diffDays <= 30) {
        upcomingExpiry.push({ product: p, daysLeft: diffDays });
      }
    }
  });
  
  if (upcomingExpiry.length === 0) {
    expAlertsList.innerHTML = '<li class="empty-alert">Tidak ada produk mendekati kadaluarsa.</li>';
  } else {
    // Urutkan dari yang paling mendesak
    upcomingExpiry.sort((a, b) => a.daysLeft - b.daysLeft);
    upcomingExpiry.forEach(item => {
      const p = item.product;
      const li = document.createElement('li');
      li.className = 'alert-item';
      
      let expText = '';
      if (item.daysLeft < 0) {
        expText = `KADALUARSA (${Math.abs(item.daysLeft)} hari lalu)`;
      } else if (item.daysLeft === 0) {
        expText = 'HARI INI KADALUARSA!';
      } else {
        expText = `${item.daysLeft} hari lagi`;
      }
      
      li.innerHTML = `
        <div class="alert-item-left">
          <span class="alert-item-name">${p.nama}</span>
          <span class="alert-item-meta">Tgl Exp: ${p.tanggal_kadaluarsa}</span>
        </div>
        <span class="alert-item-badge ${item.daysLeft <= 7 ? '' : 'warning'}">${expText}</span>
      `;
      expAlertsList.appendChild(li);
    });
  }
  
  // 3. Produk Terlaris
  const sellCounts = {};
  const sellRevenue = {};
  
  transactions.forEach(tx => {
    tx.items.forEach(item => {
      sellCounts[item.nama] = (sellCounts[item.nama] || 0) + item.qty;
      sellRevenue[item.nama] = (sellRevenue[item.nama] || 0) + (item.harga * item.qty);
    });
  });
  
  const bestSellersBody = document.getElementById('best-sellers-body');
  bestSellersBody.innerHTML = '';
  
  const sortedSellers = Object.keys(sellCounts).sort((a, b) => sellCounts[b] - sellCounts[a]);
  
  if (sortedSellers.length === 0) {
    bestSellersBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada penjualan.</td></tr>';
  } else {
    sortedSellers.slice(0, 5).forEach((nama, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${idx + 1}</strong></td>
        <td>${nama}</td>
        <td>${sellCounts[nama]}x</td>
        <td>Rp ${formatRupiah(sellRevenue[nama])}</td>
      `;
      bestSellersBody.appendChild(tr);
    });
  }
  
  // 4. Gambar Grafik Omzet 7 Hari Terakhir
  render7DayChart();
}

// Menggambar Chart Menggunakan CSS Bar
function render7DayChart() {
  const chartContainer = document.getElementById('analytics-bar-chart');
  chartContainer.innerHTML = '';
  
  const days = [];
  const now = new Date();
  
  // Generate list tanggal 7 hari terakhir
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push({
      dateStr: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })
    });
  }
  
  // Hitung total omzet per hari
  const dailyTotals = days.map(day => {
    let total = 0;
    transactions.forEach(tx => {
      if (tx.waktu && tx.waktu.slice(0, 10) === day.dateStr) {
        total += tx.total;
      }
    });
    return { label: day.label, amount: total };
  });
  
  // Cari nilai maksimum omzet
  const maxAmount = Math.max(...dailyTotals.map(d => d.amount), 100000); // minimal 100k skala tinggi
  
  // Gambar ke HTML
  dailyTotals.forEach(day => {
    const percentHeight = Math.max(5, Math.round((day.amount / maxAmount) * 100)); // min 5% agar bar terlihat sedikit jika ada data
    const container = document.createElement('div');
    container.className = 'chart-bar-container';
    
    // Tampilkan label nominal di atas bar jika nominal > 0
    const valText = day.amount > 0 ? `${Math.round(day.amount / 1000)}k` : '';
    
    container.innerHTML = `
      <div class="chart-bar" style="height: ${percentHeight}%;" title="Total Omzet: Rp ${formatRupiah(day.amount)}">
        <span class="chart-bar-val">${valText}</span>
      </div>
      <span class="chart-bar-label">${day.label}</span>
    `;
    chartContainer.appendChild(container);
  });
}

// --- KAMERA SCANNER BARCODE (html5-qrcode) ---

// Memainkan bunyi bip scanner (Web Audio API Synthesizer - 100% Offline)
function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.value = 1200; // Frekuensi bip tinggi khas POS
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      audioCtx.close();
    }, 100);
  } catch (err) {
    console.error("Gagal memainkan suara bip:", err);
  }
}

function openCameraScanner() {
  if (typeof Html5Qrcode === 'undefined') {
    alert("Maaf, modul kamera scanner gagal dimuat. Pastikan perangkat Anda terhubung ke internet saat membuka aplikasi agar modul dapat diunduh otomatis.");
    return;
  }
  
  const wrapper = document.getElementById('camera-scanner-wrapper');
  wrapper.classList.add('active');
  
  html5QrcodeScanner = new Html5Qrcode("interactive-reader", {
    // Menghapus formatsToSupport agar library memindai semua barcode 1D & 2D secara optimal
    useBarCodeDetectorIfSupported: true // Gunakan native API bawaan HP yang jauh lebih cepat dan akurat
  });
  
  // Memulai kamera belakang ponsel
  html5QrcodeScanner.start(
    { facingMode: "environment" },
    {
      fps: 15, // Ditingkatkan ke 15fps agar lebih responsif
      qrbox: { width: 250, height: 120 } // Lebih horizontal untuk barcode 1D standar
    },
    onScanSuccess,
    onScanFailure
  ).catch(err => {
    console.error("Gagal menyalakan kamera:", err);
    alert("Gagal mengakses kamera! Berikan izin kamera untuk situs ini di pengaturan browser Anda.");
    closeCameraScanner();
  });
}

function onScanSuccess(decodedText, decodedResult) {
  playBeep();
  
  const searchVal = decodedText.trim();
  const p = products.find(prod => prod.barcode === searchVal || prod.id.toLowerCase() === searchVal.toLowerCase());
  
  if (p) {
    if (p.stok > 0 || appConfig.allowZeroStock) {
      addToCart(p);
      closeCameraScanner();
      renderCart();
    } else {
      alert(`Barang "${p.nama}" ditemukan, namun stoknya kosong!`);
      closeCameraScanner();
    }
  } else {
    alert(`Barcode "${searchVal}" tidak terdaftar di inventaris!`);
    closeCameraScanner();
  }
}

function onScanFailure(error) {
  // Hanya abaikan scan kegagalan kecil (proses frame berjalan)
}

function closeCameraScanner() {
  const wrapper = document.getElementById('camera-scanner-wrapper');
  wrapper.classList.remove('active');
  
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().then(() => {
      html5QrcodeScanner = null;
      focusSearchInput();
    }).catch(err => {
      console.error("Gagal menghentikan scanner kamera:", err);
      html5QrcodeScanner = null;
      focusSearchInput();
    });
  } else {
    focusSearchInput();
  }
}

// --- TAB POS: PENCARIAN & DROPDOWN ---
function filterProducts() {
  const searchInput = document.getElementById('search-input');
  const searchVal = searchInput.value.toLowerCase().trim();
  const dropdown = document.getElementById('floating-results');
  
  if (searchVal === '') {
    closeFloatingResults();
    return;
  }
  
  // Barcode exact match logic dipindah ke handleSearchInputKeydowns saat Enter ditekan
  // untuk mencegah pemindaian sebagian jika scanner cepat.
  
  filteredProducts = products.filter(p => {
    return p.nama.toLowerCase().includes(searchVal) || 
           p.id.toLowerCase().includes(searchVal) ||
           (p.barcode && p.barcode.toLowerCase().includes(searchVal));
  }).slice(0, 15);
  
  if (filteredProducts.length === 0) {
    dropdown.innerHTML = '<div style="padding: 0.75rem 1rem; color: var(--text-muted); font-size: 0.85rem;">Barang tidak ditemukan...</div>';
    dropdown.classList.add('active');
    selectedFloatIndex = -1;
    return;
  }
  
  selectedFloatIndex = 0;
  renderFloatingDropdown();
}

function renderFloatingDropdown() {
  const dropdown = document.getElementById('floating-results');
  dropdown.innerHTML = '';
  dropdown.classList.add('active');
  
  filteredProducts.forEach((p, index) => {
    const isSelected = index === selectedFloatIndex;
    const isOutOfStock = p.stok <= 0;
    const isLowStock = p.stok > 0 && p.stok <= 5;
    
    let stockText = `Stok: ${p.stok}`;
    let stockClass = '';
    if (isOutOfStock) {
      stockText = 'Habis';
      stockClass = 'empty';
    } else if (isLowStock) {
      stockClass = 'low';
    }
    
    const div = document.createElement('div');
    div.className = `floating-item ${isSelected ? 'selected' : ''} ${isOutOfStock ? 'out-of-stock' : ''}`;
    div.onclick = () => {
      if (!isOutOfStock) {
        addToCart(p);
        document.getElementById('search-input').value = '';
        closeFloatingResults();
        focusSearchInput();
      }
    };
    
    const imgUrl = p.gambar || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100';
    
    div.innerHTML = `
      <img src="${imgUrl}" alt="${p.nama}" class="floating-item-img" onerror="handleImageError(this)">
      <div class="floating-item-info">
        <span class="floating-item-name">${p.nama} (${p.id})</span>
        <div class="floating-item-meta">
          <span class="floating-item-price">Rp ${formatRupiah(p.harga_jual)}</span>
          <span class="floating-item-stock ${stockClass}">${stockText}</span>
        </div>
      </div>
    `;
    dropdown.appendChild(div);
  });
  
  const selectedEl = dropdown.querySelector('.floating-item.selected');
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: 'nearest' });
  }
}

function closeFloatingResults() {
  const dropdown = document.getElementById('floating-results');
  if (dropdown) {
    dropdown.classList.remove('active');
  }
  filteredProducts = [];
  selectedFloatIndex = -1;
}

function handleSearchInputKeydowns(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const searchInput = document.getElementById('search-input');
    const searchVal = searchInput.value.toLowerCase().trim();
    if (!searchVal) return;
    
    // 1. Cek exact match barcode atau ID terlebih dahulu (untuk scanner)
    const exactMatch = products.find(p => 
      (p.barcode && p.barcode.toLowerCase() === searchVal) || 
      p.id.toLowerCase() === searchVal
    );
    
    if (exactMatch) {
      if (exactMatch.stok > 0 || appConfig.allowZeroStock) {
        addToCart(exactMatch);
        searchInput.value = '';
        closeFloatingResults();
      } else {
        alert("Stok barang habis!");
      }
      return;
    }
    
    // 2. Jika tidak ada exact match, gunakan hasil pilihan dropdown
    if (filteredProducts.length > 0 && selectedFloatIndex > -1 && selectedFloatIndex < filteredProducts.length) {
      const prod = filteredProducts[selectedFloatIndex];
      if (prod.stok > 0 || appConfig.allowZeroStock) {
        addToCart(prod);
        searchInput.value = '';
        closeFloatingResults();
      } else {
        alert("Stok barang habis!");
      }
    }
    return;
  }
  
  if (filteredProducts.length === 0) return;
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedFloatIndex = (selectedFloatIndex + 1) % filteredProducts.length;
    renderFloatingDropdown();
  } 
  else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedFloatIndex = (selectedFloatIndex - 1 + filteredProducts.length) % filteredProducts.length;
    renderFloatingDropdown();
  } 
}

// --- TAB POS: KERANJANG ---
function addToCart(product) {
  if (appConfig.strictShift && !activeShift) {
    alert("Wajib buka shift terlebih dahulu untuk melakukan transaksi!");
    return;
  }
  let totalQty = cart.filter(i => i.id === product.id).reduce((sum, i) => sum + i.qty, 0);
  totalQty += 1;
  recalculateCartSplit(product.id, totalQty);
}

function updateCartQty(cartId, delta) {
  const itemIndex = cart.findIndex(item => item.cartId === cartId);
  if (itemIndex === -1) return;
  const baseId = cart[itemIndex].id;
  
  let totalQty = cart.filter(i => i.id === baseId).reduce((sum, i) => sum + i.qty, 0);
  totalQty += delta;
  
  recalculateCartSplit(baseId, totalQty);
}

function removeFromCart(cartId) {
  const itemIndex = cart.findIndex(item => item.cartId === cartId);
  if (itemIndex === -1) return;
  const baseId = cart[itemIndex].id;
  const itemToRemove = cart[itemIndex];
  
  let totalQty = cart.filter(i => i.id === baseId).reduce((sum, i) => sum + i.qty, 0);
  totalQty -= itemToRemove.qty;
  
  recalculateCartSplit(baseId, totalQty);
}

function setCartQtyDirect(cartId, value) {
  const qty = parseInt(value) || 1;
  const item = cart.find(it => it.cartId === cartId);
  if (!item) return;
  const baseId = item.id;
  
  let totalQty = cart.filter(i => i.id === baseId).reduce((sum, i) => sum + i.qty, 0);
  totalQty = totalQty - item.qty + qty;
  
  recalculateCartSplit(baseId, totalQty);
}

function recalculateCartSplit(baseId, totalQty) {
  // Hapus semua item lama dengan baseId yang sama
  cart = cart.filter(i => i.id !== baseId);
  
  if (totalQty <= 0) {
    renderCart();
    return;
  }
  
  const localProd = products.find(p => p.id === baseId);
  if (!localProd) return;
  
  if (totalQty > localProd.stok && !appConfig.allowZeroStock) {
    alert(`Stok tidak mencukupi! Hanya tersisa ${localProd.stok} barang.`);
    totalQty = localProd.stok;
  }
  
  const hargaDiskon = parseFloat(localProd.harga_diskon) || 0;
  const kuotaDiskon = (parseInt(localProd.kuota_diskon) || 0) > 0 ? parseInt(localProd.kuota_diskon) : Infinity;
  const hasPromo = appConfig.enablePromo && hargaDiskon > 0;
  
  if (hasPromo) {
    const promoQty = Math.min(totalQty, kuotaDiskon);
    const regQty = totalQty - promoQty;
    
    if (promoQty > 0) {
      cart.push({
        id: baseId,
        cartId: baseId + '_promo',
        nama: localProd.nama + ' (Promo)',
        harga: hargaDiskon,
        harga_beli: parseFloat(localProd.harga_beli) || 0,
        qty: promoQty,
        isPromo: true
      });
    }
    
    if (regQty > 0) {
      cart.push({
        id: baseId,
        cartId: baseId + '_reguler',
        nama: localProd.nama,
        harga: localProd.harga_jual,
        harga_beli: localProd.harga_beli,
        qty: regQty,
        isPromo: false
      });
    }
  } else {
    cart.push({
      id: baseId,
      cartId: baseId + '_reguler',
      nama: localProd.nama,
      harga: localProd.harga_jual,
      harga_beli: localProd.harga_beli,
      qty: totalQty,
      isPromo: false
    });
  }
  
  renderCart();
}

function checkPromoBanner() {
  const container = document.getElementById('promo-carousel-container');
  const marqueeContent = document.getElementById('promo-marquee-content');
  if (!container || !marqueeContent) return;
  
  const promos = appConfig.enablePromo ? products.filter(p => parseFloat(p.harga_diskon) > 0) : [];
  
  if (promos.length === 0) {
    container.style.display = 'none';
    marqueeContent.innerHTML = '';
    return;
  }
  
  container.style.display = 'block';
  let html = '';
  
  promos.forEach((p, i) => {
    html += `
      <div class="promo-marquee-item ${i === 0 ? 'active' : ''}">
        ${p.nama}: <span class="highlight">Rp ${formatRupiah(p.harga_diskon)}</span> 
        <s style="color: var(--color-danger); opacity: 0.8; margin-left: 0.25rem;">Rp ${formatRupiah(p.harga_jual)}</s>
      </div>
    `;
  });
  
  marqueeContent.innerHTML = html;
  
  if (window.promoCarouselInterval) {
    clearInterval(window.promoCarouselInterval);
  }
  
  if (promos.length > 1) {
    let currentIndex = 0;
    const items = marqueeContent.querySelectorAll('.promo-marquee-item');
    window.promoCarouselInterval = setInterval(() => {
      items[currentIndex].classList.remove('active');
      currentIndex = (currentIndex + 1) % items.length;
      items[currentIndex].classList.add('active');
    }, 3000);
  }
}

function saveCart() {
  localStorage.setItem('kasir_active_cart', JSON.stringify(cart));
}

function clearCart() {
  if (cart.length === 0) return;
  if (confirm("Apakah Anda yakin ingin mengosongkan keranjang belanja?")) {
    cart = [];
    renderCart();
  }
}

function renderCart() {
  saveCart();
  const container = document.getElementById('cart-list');
  container.innerHTML = '';
  
  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart-state">
        <svg viewBox="0 0 24 24" class="icon-empty"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
        <p>Keranjang kosong. Cari barang atau gunakan tombol scan kamera di atas.</p>
      </div>
    `;
    
    document.getElementById('subtotal-val').textContent = 'Rp 0';
    document.getElementById('total-val').textContent = 'Rp 0';
    document.getElementById('btn-proceed').disabled = true;
    return;
  }
  
  cart.forEach(item => {
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-name">${item.nama}</div>
        <div class="cart-item-price">Rp ${formatRupiah(item.harga)}</div>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="updateCartQty('${item.cartId}', -1)">-</button>
        <input type="number" class="qty-input" value="${item.qty}" min="1" onchange="setCartQtyDirect('${item.cartId}', this.value)">
        <button class="qty-btn" onclick="updateCartQty('${item.cartId}', 1)">+</button>
        <button class="remove-item-btn" onclick="removeFromCart('${item.cartId}')">
          <svg viewBox="0 0 24 24" class="icon-sm"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
        </button>
      </div>
    `;
    container.appendChild(div);
  });
  
  calculateTotal();
}

let globalTotal = 0;
function calculateTotal() {
  let subtotal = 0;
  cart.forEach(item => {
    subtotal += item.harga * item.qty;
  });
  
  const discountInput = document.getElementById('discount-input');
  let discountPercent = parseInt(discountInput.value) || 0;
  if (discountPercent < 0) discountPercent = 0;
  if (discountPercent > 100) discountPercent = 100;
  
  const discountAmount = (discountPercent / 100) * subtotal;
  globalTotal = subtotal - discountAmount;
  
  document.getElementById('subtotal-val').textContent = `Rp ${formatRupiah(subtotal)}`;
  document.getElementById('total-val').textContent = `Rp ${formatRupiah(globalTotal)}`;
  
  document.getElementById('btn-proceed').disabled = cart.length === 0;
}

// --- MODAL PEMBAYARAN (STEP 2) ---
function openPaymentModal() {
  if (cart.length === 0) return;
  
  document.getElementById('pay-total-amount').textContent = `Rp ${formatRupiah(globalTotal)}`;
  
  // Reset payment method and status
  const methodSelect = document.getElementById('payment-method-select');
  const statusSelect = document.getElementById('payment-status-select');
  
  methodSelect.value = 'Tunai';
  methodSelect.disabled = false;
  statusSelect.value = 'Lunas';
  statusSelect.disabled = false;
  
  // Populate Customer Datalist
  const datalist = document.getElementById('customer-list');
  if (datalist) {
    datalist.innerHTML = customers.map(c => `<option value="${c.nama}">`).join('');
  }
  
  const customerNameGroup = document.getElementById('customer-name-group');
  if (appConfig.customerMode) {
    customerNameGroup.style.display = 'block';
    document.getElementById('customer-name-input').value = '';
    document.getElementById('customer-points-info').style.display = 'none';
    document.getElementById('redeem-points-input').value = '';
  } else {
    customerNameGroup.style.display = 'none';
  }
  
  const cashInput = document.getElementById('cash-received');
  cashInput.value = '';
  document.getElementById('cash-received-group').style.display = 'block';
  document.getElementById('quick-cash-grid-container').style.display = 'grid';
  document.getElementById('cash-received-label').textContent = "Uang Diterima dari Konsumen (Rp)*";
  
  calculateChange();
  
  document.getElementById('payment-modal').classList.add('active');
  setTimeout(() => {
    cashInput.focus();
  }, 100);
}

function onPaymentMethodChange(val) {
  const cashInput = document.getElementById('cash-received');
  const cashGroup = document.getElementById('cash-received-group');
  const quickCashGrid = document.getElementById('quick-cash-grid-container');
  const statusSelect = document.getElementById('payment-status-select');
  
  if (val !== 'Tunai') {
    // Non-tunai otomatis Lunas dan Uang Pas
    statusSelect.value = 'Lunas';
    onPaymentStatusChange('Lunas');
    statusSelect.disabled = true; // non-tunai tidak bisa Bon
    
    cashInput.value = formatRupiah(globalTotal);
    cashGroup.style.display = 'none';
    quickCashGrid.style.display = 'none';
  } else {
    statusSelect.disabled = false;
    cashInput.value = '';
    cashGroup.style.display = 'block';
    quickCashGrid.style.display = 'grid';
  }
  calculateChange();
}

function onPaymentStatusChange(val) {
  const cashInput = document.getElementById('cash-received');
  const cashLabel = document.getElementById('cash-received-label');
  const quickCashGrid = document.getElementById('quick-cash-grid-container');
  
  if (val === 'Bon') {
    cashLabel.textContent = "Uang Muka / DP dibayarkan (Rp)";
    cashInput.placeholder = "Bisa dikosongkan (Rp 0)...";
    cashInput.value = '';
    quickCashGrid.style.display = 'none'; // sembunyikan quick cash karena bayar bebas/DP
  } else {
    cashLabel.textContent = "Uang Diterima dari Konsumen (Rp)*";
    cashInput.placeholder = "Masukkan jumlah uang...";
    cashInput.value = '';
    quickCashGrid.style.display = 'grid';
  }
  calculateChange();
}

function closePaymentModal() {
  document.getElementById('payment-modal').classList.remove('active');
  focusSearchInput();
}

function formatAndCalculateChange() {
  const input = document.getElementById('cash-received');
  const cleanVal = input.value.replace(/\D/g, "");
  if (cleanVal === "") {
    input.value = "";
  } else {
    input.value = new Intl.NumberFormat('id-ID').format(cleanVal);
  }
  calculateChange();
}

function calculateChange() {
  const cashInput = document.getElementById('cash-received');
  const changeVal = document.getElementById('change-val');
  const btnSubmit = document.getElementById('btn-submit-payment');
  const method = document.getElementById('payment-method-select').value;
  const status = document.getElementById('payment-status-select').value;
  
  const cashText = cashInput.value.replace(/\./g, ""); // Hapus titik ribuan
  const cash = parseFloat(cashText) || 0;
  // Hitung potongan poin
  const redeemInput = document.getElementById('redeem-points-input');
  let redeemPoints = parseInt(redeemInput ? redeemInput.value : 0) || 0;
  
  // Validasi max poin
  const selectedCustomerName = document.getElementById('customer-name-input').value.trim();
  const customer = customers.find(c => c.nama === selectedCustomerName);
  if (customer && redeemPoints > customer.poin) {
    redeemPoints = customer.poin;
    if (redeemInput) redeemInput.value = redeemPoints;
  }
  
  let pointDiscount = redeemPoints * loyaltySettings.rpPerPoint;
  
  // Jangan biarkan diskon poin melebihi total belanja
  if (pointDiscount > globalTotal) {
    pointDiscount = globalTotal;
    redeemPoints = Math.floor(globalTotal / loyaltySettings.rpPerPoint);
    if (redeemInput) redeemInput.value = redeemPoints;
  }
  
  if (document.getElementById('redeem-points-discount')) {
    document.getElementById('redeem-points-discount').textContent = `Rp ${formatRupiah(pointDiscount)}`;
  }
  
  const finalTotalToPay = globalTotal - pointDiscount;
  document.getElementById('pay-total-amount').textContent = `Rp ${formatRupiah(finalTotalToPay)}`;
  
  const change = cash - finalTotalToPay;
  
  const changeBox = changeVal.parentElement;
  const changeLabel = changeBox.querySelector('.bill-label');
  
  if (status === 'Bon') {
    if (changeLabel) changeLabel.textContent = "SISA BON PIUTANG (DEBT)";
    
    if (change >= 0) {
      changeVal.textContent = 'Rp 0 (Lunas)';
      changeVal.className = 'bill-amount change-ok';
      if (changeBox) changeBox.className = 'payment-bill-box change-box-large change-ok';
      btnSubmit.disabled = false;
    } else {
      const sisaPiutang = Math.abs(change);
      changeVal.textContent = `Rp ${formatRupiah(sisaPiutang)}`;
      changeVal.className = 'bill-amount change-neutral';
      if (changeBox) changeBox.className = 'payment-bill-box change-box-large change-neutral';
      btnSubmit.disabled = false; // Bon diperbolehkan bayar kurang atau Rp 0
    }
  } else {
    if (changeLabel) changeLabel.textContent = "KEMBALIAN";
    
    if (cashInput.value === '' && method === 'Tunai') {
      changeVal.textContent = 'Rp 0';
      changeVal.className = 'bill-amount change-neutral';
      if (changeBox) changeBox.className = 'payment-bill-box change-box-large change-neutral';
      btnSubmit.disabled = true;
    } else if (change >= 0) {
      changeVal.textContent = `Rp ${formatRupiah(change)}`;
      changeVal.className = 'bill-amount change-ok';
      if (changeBox) changeBox.className = 'payment-bill-box change-box-large change-ok';
      btnSubmit.disabled = false;
    } else {
      changeVal.textContent = `Kurang Rp ${formatRupiah(Math.abs(change))}`;
      changeVal.className = 'bill-amount change-insufficient';
      if (changeBox) changeBox.className = 'payment-bill-box change-box-large change-insufficient';
      btnSubmit.disabled = true;
    }
  }
}

function setQuickCash(amount) {
  const cashInput = document.getElementById('cash-received');
  if (amount === 'pass') {
    cashInput.value = new Intl.NumberFormat('id-ID').format(globalTotal);
  } else {
    cashInput.value = new Intl.NumberFormat('id-ID').format(amount);
  }
  calculateChange();
  cashInput.focus();
}

// --- PROSES CHECKOUT TRANSAKSI ---
async function processCheckout() {
  if (cart.length === 0) return;
  
  const method = document.getElementById('payment-method-select').value;
  const status = document.getElementById('payment-status-select').value;
  const customerName = document.getElementById('customer-name-input').value.trim();
  
  if (status === 'Bon' && customerName === '') {
    alert("Untuk pembayaran Bon, Nama Pelanggan wajib diisi!");
    return;
  }
  
  // Ambil data pelanggan (jika ada)
  const customer = customers.find(c => c.nama === customerName);
  
  // Kalkulasi poin
  const redeemInput = document.getElementById('redeem-points-input');
  let redeemPoints = parseInt(redeemInput ? redeemInput.value : 0) || 0;
  if (customer && redeemPoints > customer.poin) redeemPoints = customer.poin;
  let pointDiscount = redeemPoints * loyaltySettings.rpPerPoint;
  if (pointDiscount > globalTotal) {
    pointDiscount = globalTotal;
    redeemPoints = Math.floor(globalTotal / loyaltySettings.rpPerPoint);
  }
  
  const finalTotalToPay = globalTotal - pointDiscount;
  
  const cashInput = document.getElementById('cash-received');
  const cashText = cashInput.value.replace(/\./g, ""); // Hapus titik ribuan
  const cash = parseFloat(cashText) || 0;
  
  if (status !== 'Bon' && cash < finalTotalToPay) {
    alert("Pembayaran kurang!");
    return;
  }
  
  const change = status === 'Bon' ? (cash >= finalTotalToPay ? cash - finalTotalToPay : 0) : cash - finalTotalToPay;
  const sisaPiutang = status === 'Bon' ? (cash < finalTotalToPay ? finalTotalToPay - cash : 0) : 0;
  
  const txId = 'TX-' + Date.now().toString().slice(-8);
  const now = new Date();
  
  const transaction = {
    id: txId,
    waktu: now.toISOString(),
    items: [...cart],
    total: globalTotal,
    diskon_poin: pointDiscount, // Track diskon poin
    poin_ditukar: redeemPoints, // Track poin ditukar
    bayar: cash,
    kembalian: change,
    metode_pembayaran: method,
    kasir: activeCashier,
    status_pembayaran: sisaPiutang > 0 ? 'Bon' : 'Lunas',
    nama_pelanggan: customerName, // Selalu catat jika ada
    sisa_piutang: sisaPiutang,
    id_shift: activeShift ? activeShift.id_shift : null
  };
  
  // Update poin pelanggan
  if (customer) {
    customer.poin -= redeemPoints; // Kurangi poin
    // Tambah poin baru berdasarkan total bayar
    const earnedPoints = Math.floor(finalTotalToPay / loyaltySettings.pointsPerRp);
    customer.poin += earnedPoints;
    
    transaction.poin_didapat = earnedPoints; // Track poin didapat
    
    saveCustomersLocally();
    renderCustomersTable(); // Refresh tabel pelanggan di background
  }
  
  // 1. Kurangi stok produk secara lokal
  cart.forEach(cartItem => {
    const localProd = products.find(p => p.id === cartItem.id);
    if (localProd) {
      localProd.stok = Math.max(0, localProd.stok - cartItem.qty);
      if (cartItem.isPromo) {
        let prevKuota = parseInt(localProd.kuota_diskon) || 0;
        if (prevKuota > 0) {
          localProd.kuota_diskon = Math.max(0, prevKuota - cartItem.qty);
          if (localProd.kuota_diskon === 0) {
            localProd.harga_diskon = 0; // Disable promo once quota runs out
          }
        }
      }
    }
  });
  saveProductsLocally();
  checkPromoBanner();
  
  // 2. Simpan transaksi ke riwayat lokal untuk dashboard analisis
  transactions.push(transaction);
  localStorage.setItem('kasir_transactions', JSON.stringify(transactions));
  
  // 3. Tutup modal pembayaran & Kosongkan keranjang
  document.getElementById('payment-modal').classList.remove('active');
  const lastCart = [...cart];
  cart = [];
  renderCart();
  
  // Reset input diskon
  document.getElementById('discount-input').value = 0;
  
  // 4. Tampilkan struk
  showReceipt(transaction, lastCart);
  
  // 5. Kirim ke Google Sheets
  syncTransactionToCloud(transaction);
}

// (Logika Countdown Struk Belanja Dihilangkan)

// Tampilkan Struk Belanja
function showReceipt(tx, items) {
  currentTxForPrint = tx;
  currentItemsForPrint = items;
  
  document.getElementById('rec-id').textContent = tx.id;
  
  const dateObj = new Date(tx.waktu);
  const timeStr = dateObj.toLocaleDateString('id-ID') + ' ' + dateObj.toLocaleTimeString('id-ID', { hour12: false });
  document.getElementById('rec-time').textContent = timeStr;
  
  const cashierEl = document.getElementById('rec-cashier');
  if (cashierEl) cashierEl.textContent = tx.kasir || 'Kasir Utama';
  
  const recItems = document.getElementById('rec-items');
  recItems.innerHTML = '';
  
  let subtotal = 0;
  items.forEach(item => {
    subtotal += item.harga * item.qty;
    const row = document.createElement('div');
    row.className = 'receipt-item-row';
    row.innerHTML = `
      <div class="receipt-item-row-top" style="align-items: flex-start;">
        <span style="flex: 1; padding-right: 0.5rem;">${item.nama}</span>
        <div style="text-align: right; display: flex; flex-direction: column;">
          <span>Rp ${formatRupiah(item.harga * item.qty)}</span>
          <span style="font-size: 0.9em; font-weight: 500; color: #444; margin-top: 2px;">${item.qty}x @Rp ${formatRupiah(item.harga)}</span>
        </div>
      </div>
    `;
    recItems.appendChild(row);
  });
  
  const discountPercent = subtotal > 0 ? Math.round(((subtotal - tx.total) / subtotal) * 100) : 0;
  
  document.getElementById('rec-subtotal').textContent = `Rp ${formatRupiah(subtotal)}`;
  document.getElementById('rec-discount').textContent = `${discountPercent}%`;
  document.getElementById('rec-total').textContent = `Rp ${formatRupiah(tx.total)}`;
  document.getElementById('rec-cash').textContent = `Rp ${formatRupiah(tx.bayar)}`;
  document.getElementById('rec-change').textContent = `Rp ${formatRupiah(tx.kembalian)}`;
  
  // Rincian Metode & Piutang (Fitur Baru)
  
  const ptRow = document.getElementById('rec-point-discount-row');
  if (ptRow) {
    if (tx.diskon_poin > 0) {
      document.getElementById('rec-point-discount').textContent = `-Rp ${formatRupiah(tx.diskon_poin)}`;
      ptRow.style.display = 'flex';
    } else {
      ptRow.style.display = 'none';
    }
  }
  
  const crmInfo = document.getElementById('rec-crm-info');
  if (crmInfo) {
    if (tx.nama_pelanggan) {
      const customer = customers.find(c => c.nama === tx.nama_pelanggan);
      crmInfo.style.display = 'block';
      document.getElementById('rec-points-earned').textContent = tx.poin_didapat || 0;
      document.getElementById('rec-points-total').textContent = customer ? (customer.poin || 0) : (tx.poin_didapat || 0);
    } else {
      crmInfo.style.display = 'none';
    }
  }
  const methodEl = document.getElementById('rec-method');
  if (methodEl) {
    methodEl.textContent = tx.metode_pembayaran || 'Tunai';
    if (tx.status_pembayaran === 'Bon') {
      methodEl.textContent += ' (Bon)';
    }
  }
  
  const debtRow = document.getElementById('rec-debt-row');
  const debtVal = document.getElementById('rec-debt');
  if (debtRow && debtVal) {
    if (tx.sisa_piutang > 0) {
      debtVal.textContent = `Rp ${formatRupiah(tx.sisa_piutang)}`;
      debtRow.style.display = 'flex';
    } else {
      debtRow.style.display = 'none';
    }
  }
  
  document.getElementById('receipt-modal').classList.add('active');
  
  // Set default pemilihan tombol struk ke "Cetak Nota" (index 0)
  selectedReceiptButtonIndex = 0;
  updateReceiptButtonsHighlight();
  

}

function updateReceiptButtonsHighlight() {
  const btnPrint = document.getElementById('btn-print-receipt');
  const btnSkip = document.getElementById('btn-skip-receipt');
  if (!btnPrint || !btnSkip) return;
  
  if (selectedReceiptButtonIndex === 0) {
    // Highlight Cetak Nota (Primary)
    btnPrint.className = 'btn btn-primary';
    btnSkip.className = 'btn btn-secondary';
    btnPrint.focus();
  } else {
    // Highlight Tidak (Primary)
    btnPrint.className = 'btn btn-secondary';
    btnSkip.className = 'btn btn-primary';
    btnSkip.focus();
  }
}

function closeReceiptModal() {
  document.getElementById('receipt-modal').classList.remove('active');
  focusSearchInput();
}

function triggerPrintReceipt() {
  const receiptEl = document.getElementById('receipt-card-print');
  if (!receiptEl) {
    alert("Elemen struk tidak ditemukan!");
    return;
  }
  
  // Clone struk dari yang tampil di layar
  const printContent = receiptEl.cloneNode(true);
  
  // Bersihkan elemen tombol dan pintasan keyboard agar tidak ikut tercetak
  const actions = printContent.querySelector('.modal-actions');
  if (actions) actions.remove();
  const shortcutTip = printContent.querySelector('.shortcut-tip');
  if (shortcutTip) shortcutTip.remove();
  const dividerNoPrint = printContent.querySelector('.divider-dashed.no-print');
  if (dividerNoPrint) dividerNoPrint.remove();

  // Buat iframe tersembunyi
  let iframe = document.getElementById('receipt-print-iframe');
  if (iframe) {
    iframe.remove();
  }
  
  iframe = document.createElement('iframe');
  iframe.id = 'receipt-print-iframe';
  iframe.style.position = 'absolute';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';
  iframe.style.top = '-1000px';
  iframe.style.left = '-1000px';
  
  // Daftarkan event listener onload SEBELUM menulis konten dan SEBELUM append ke DOM untuk reliabilitas tinggi
  iframe.onload = () => {
    // Berikan jeda waktu 150ms agar engine render browser menyelesaikan tugasnya
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error("Gagal mencetak melalui iframe terisolasi, fallback ke window.print():", e);
        window.print();
      }
    }, 150);
  };
  
  document.body.appendChild(iframe);
  
  const doc = iframe.contentWindow.document || iframe.contentDocument;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cetak Nota</title>
      <style>
        /* Import font Google 'Plus Jakarta Sans' agar sama persis */
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        
        @page {
          margin: 0;
          size: 58mm auto;
        }
        
        body {
          margin: 0;
          padding: 0;
          width: 58mm;
          display: flex;
          justify-content: center;
          background-color: #fff;
          color: #000;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        /* Layout struk disesuaikan agar pas di kertas thermal 58mm */
        .receipt-card {
          background-color: #ffffff;
          color: #111111;
          width: 52mm; /* Pas dengan area cetak bersih 58mm printer thermal */
          max-width: 52mm;
          padding: 0 1.5mm;
          box-sizing: border-box;
          font-family: monospace;
          display: flex;
          flex-direction: column;
        }
        
        .receipt-card * {
          color: #000 !important; /* Paksa hitam pekat agar tidak blur saat dicetak */
        }
        
        .receipt-logo-img {
          height: 72px !important; /* Perbesar Logo (Sesuai Permintaan) */
          max-width: 160px !important; /* Perbesar Logo (Sesuai Permintaan) */
          object-fit: contain;
          margin-bottom: 0.5rem;
          display: block;
          margin-left: auto;
          margin-right: auto;
        }
        
        .receipt-header {
          text-align: center;
          margin-bottom: 0.5rem;
          font-size: ${receiptSettings.fontSizeHeader}px !important; /* Dinamis sesuai pengaturan */
        }
        
        .receipt-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 1.5em !important; /* Lebih besar & tebal (Sesuai Permintaan) */
          font-weight: 900 !important; /* Tebal ekstra (Sesuai Permintaan) */
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
          text-align: center;
        }
        
        .receipt-subtitle {
          font-size: 0.85em !important;
          margin-bottom: 0.05rem;
          text-align: center;
        }
        
        .divider-dashed {
          border-top: 1px dashed #222222;
          margin: 0.5rem 0;
          width: 100%;
        }
        
        .receipt-details {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          font-size: ${receiptSettings.fontSizeItems}px !important; /* Dinamis sesuai pengaturan */
        }
        
        .receipt-detail-row {
          display: flex;
          justify-content: space-between;
        }
        
        .receipt-items {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          font-size: ${receiptSettings.fontSizeItems}px !important; /* Dinamis sesuai pengaturan */
        }
        
        .receipt-item-row {
          display: flex;
          flex-direction: column;
        }
        
        .receipt-item-row-top {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
        }
        
        .receipt-item-row-bottom {
          display: flex;
          justify-content: space-between;
          font-size: 0.95em !important;
          padding-left: 0.25rem;
        }
        
        .receipt-totals {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: ${receiptSettings.fontSizeFooter}px !important; /* Dinamis sesuai pengaturan */
        }
        
        .receipt-total-row {
          display: flex;
          justify-content: space-between;
        }
        
        .receipt-total-row.final-total {
          font-size: 1.1em !important; /* Sedikit lebih besar dari footer total */
          font-weight: bold;
          border-top: 1px dashed #222222;
          border-bottom: 1px dashed #222222;
          padding: 0.25rem 0;
        }
        
        .receipt-footer {
          text-align: center;
          margin-top: 0.75rem;
          font-size: ${receiptSettings.fontSizeFooter * 0.9}px !important; /* Dinamis sesuai pengaturan */
        }
      </style>
    </head>
    <body>
      ${printContent.outerHTML}
    </body>
    </html>
  `);
  doc.close();
}

async function syncTransactionToCloud(tx) {
  if (!gasUrl) {
    queueOfflineTransaction(tx);
    return;
  }
  
  updateSyncStatus('syncing', 'Mengirim transaksi...');
  const result = await fetchFromGAS('addTransaction', { transaction: tx });
  
  if (result && result.status === 'success') {
    updateSyncStatus('online', 'Tersinkronisasi');
    processOfflineQueue();
  } else {
    queueOfflineTransaction(tx);
  }
}

function queueOfflineTransaction(tx) {
  offlineQueue.push(tx);
  saveOfflineQueue();
  updateSyncStatus('offline', `Offline (${offlineQueue.length} transaksi tertunda)`);
}

function saveOfflineQueue() {
  localStorage.setItem('kasir_offline_queue', JSON.stringify(offlineQueue));
}

async function processOfflineQueue() {
  if (offlineQueue.length === 0 || !gasUrl) return;
  
  updateSyncStatus('syncing', `Mengirim ${offlineQueue.length} antrean...`);
  
  const queueToProcess = [...offlineQueue];
  let successCount = 0;
  
  for (let i = 0; i < queueToProcess.length; i++) {
    const tx = queueToProcess[i];
    const result = await fetchFromGAS('addTransaction', { transaction: tx });
    if (result && result.status === 'success') {
      successCount++;
    } else {
      break;
    }
  }
  
  offlineQueue.splice(0, successCount);
  saveOfflineQueue();
  
  if (offlineQueue.length === 0) {
    updateSyncStatus('online', 'Tersinkronisasi');
  } else {
    updateSyncStatus('offline', `Offline (${offlineQueue.length} transaksi tertunda)`);
  }
}

// --- TAB 3: FITUR KULAK (RESTOCK BARANG DATANG) ---

function filterKulakSearch() {
  const input = document.getElementById('kulak-search-input');
  const val = input.value.toLowerCase().trim();
  const dropdown = document.getElementById('kulak-floating-results');
  
  if (val === '') {
    closeKulakFloatingResults();
    return;
  }
  
  // Cek barcode match langsung
  const barcodeMatch = products.find(p => p.barcode && p.barcode.toLowerCase() === val);
  if (barcodeMatch) {
    openKulakForm(barcodeMatch);
    input.value = '';
    closeKulakFloatingResults();
    return;
  }
  
  kulakFilteredProducts = products.filter(p => {
    return p.nama.toLowerCase().includes(val) || 
           p.id.toLowerCase().includes(val) ||
           (p.barcode && p.barcode.toLowerCase().includes(val));
  }).slice(0, 15);
  
  if (kulakFilteredProducts.length === 0) {
    dropdown.innerHTML = '<div style="padding: 0.75rem 1rem; color: var(--text-muted); font-size: 0.85rem;">Barang tidak ditemukan...</div>';
    dropdown.classList.add('active');
    selectedKulakFloatIndex = -1;
    return;
  }
  
  selectedKulakFloatIndex = 0;
  renderKulakFloatingDropdown();
}

function renderKulakFloatingDropdown() {
  const dropdown = document.getElementById('kulak-floating-results');
  dropdown.innerHTML = '';
  dropdown.classList.add('active');
  
  kulakFilteredProducts.forEach((p, index) => {
    const isSelected = index === selectedKulakFloatIndex;
    const div = document.createElement('div');
    div.className = `floating-item ${isSelected ? 'selected' : ''}`;
    div.onclick = () => {
      openKulakForm(p);
    };
    
    const imgUrl = p.gambar || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100';
    
    div.innerHTML = `
      <img src="${imgUrl}" alt="${p.nama}" class="floating-item-img" onerror="handleImageError(this)">
      <div class="floating-item-info">
        <span class="floating-item-name">${p.nama} (${p.id})</span>
        <div class="floating-item-meta">
          <span class="floating-item-price">Beli: Rp ${formatRupiah(p.harga_beli)} | Jual: Rp ${formatRupiah(p.harga_jual)}</span>
          <span class="floating-item-stock">Stok: ${p.stok}</span>
        </div>
      </div>
    `;
    dropdown.appendChild(div);
  });
}

function closeKulakFloatingResults() {
  const dropdown = document.getElementById('kulak-floating-results');
  if (dropdown) dropdown.classList.remove('active');
  kulakFilteredProducts = [];
  selectedKulakFloatIndex = -1;
}

function handleKulakSearchInputKeydowns(e) {
  if (kulakFilteredProducts.length === 0) return;
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedKulakFloatIndex = (selectedKulakFloatIndex + 1) % kulakFilteredProducts.length;
    renderKulakFloatingDropdown();
  } 
  else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedKulakFloatIndex = (selectedKulakFloatIndex - 1 + kulakFilteredProducts.length) % kulakFilteredProducts.length;
    renderKulakFloatingDropdown();
  } 
  else if (e.key === 'Enter') {
    e.preventDefault();
    if (selectedKulakFloatIndex > -1 && selectedKulakFloatIndex < kulakFilteredProducts.length) {
      openKulakForm(kulakFilteredProducts[selectedKulakFloatIndex]);
    }
  }
}

// Buka form pengisian Kulak produk
function openKulakForm(p) {
  document.getElementById('kulak-edit-id').value = p.id;
  document.getElementById('kulak-prod-name').textContent = p.nama;
  document.getElementById('kulak-prod-id').textContent = `ID: ${p.id} | Barcode: ${p.barcode || '-'}`;
  document.getElementById('kulak-prod-current-stock').textContent = `Stok Saat Ini: ${p.stok} pcs`;
  
  const imgUrl = p.gambar || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100';
  document.getElementById('kulak-prod-img').src = imgUrl;
  
  // Set default values form
  document.getElementById('kulak-qty-add').value = '';
  document.getElementById('kulak-price-buy').value = p.harga_beli;
  document.getElementById('kulak-price-sell').value = p.harga_jual;
  document.getElementById('kulak-date-expiry').value = p.tanggal_kadaluarsa || '';
  
  document.getElementById('kulak-form-card').style.display = 'block';
  closeKulakFloatingResults();
  document.getElementById('kulak-search-input').value = '';
  
  // Fokuskan kursor ke input Stok Masuk
  setTimeout(() => {
    document.getElementById('kulak-qty-add').focus();
  }, 100);
}

function closeKulakForm() {
  document.getElementById('kulak-form-card').style.display = 'none';
  document.getElementById('kulak-search-input').value = '';
  focusKulakSearch();
}

function saveKulak(e) {
  e.preventDefault();
  
  const id = document.getElementById('kulak-edit-id').value;
  const qtyAdd = parseInt(document.getElementById('kulak-qty-add').value) || 0;
  const newBuyPrice = parseFloat(document.getElementById('kulak-price-buy').value) || 0;
  const newSellPrice = parseFloat(document.getElementById('kulak-price-sell').value) || 0;
  const newExpiry = document.getElementById('kulak-date-expiry').value;
  
  const p = products.find(prod => prod.id === id);
  if (p) {
    const oldPrice = p.harga_jual;
    const isPriceIncreased = newSellPrice > oldPrice;

    p.stok = p.stok + qtyAdd;
    p.harga_beli = newBuyPrice;
    p.harga_jual = newSellPrice;
    p.tanggal_kadaluarsa = newExpiry;
    
    saveProductsLocally();
    alert(`Berhasil kulak barang! Stok "${p.nama}" sekarang menjadi ${p.stok} pcs.`);
    closeKulakForm();
    
    // Sinkronkan ke cloud secara massal di latar belakang (tanpa lag)
    syncProductsToCloudBackground();

    if (isPriceIncreased) {
      showPriceChangeNotification(p, oldPrice, newSellPrice);
    }
  }
}

// Sinkronisasi diam-diam di background (Kulak / Edit barang)
async function syncProductsToCloudBackground() {
  if (!gasUrl) return;
  updateSyncStatus('syncing', 'Menyinkronkan...');
  const result = await fetchFromGAS('updateProducts', { products: products });
  if (result && result.status === 'success') {
    updateSyncStatus('online', 'Tersinkronisasi');
  } else {
    updateSyncStatus('offline', 'Koneksi Terputus');
  }
}

// --- TAB 4: DAFTAR INVENTARIS PRODUK ---

// Render Tabel Produk (Mendukung filter pencarian lokal & pembatasan render)
function renderProductsTable() {
  const tbody = document.getElementById('products-table-body');
  tbody.innerHTML = '';
  
  // Reset checkbox master awal
  const selectAllCb = document.getElementById('select-all-products');
  if (selectAllCb) selectAllCb.checked = false;
  
  const searchVal = document.getElementById('product-list-search').value.toLowerCase().trim();
  
  // Filter produk
  let matched = products.filter(p => {
    return p.nama.toLowerCase().includes(searchVal) || 
           p.id.toLowerCase().includes(searchVal) ||
           (p.barcode && p.barcode.toLowerCase().includes(searchVal)) ||
           (p.kategori && p.kategori.toLowerCase().includes(searchVal));
  });
  
  // Sort produk
  const sortSelect = document.getElementById('product-list-sort');
  if (sortSelect) {
    const sortValue = sortSelect.value;
    matched.sort((a, b) => {
      if (sortValue === 'name_asc') {
        return a.nama.localeCompare(b.nama);
      } else if (sortValue === 'category_asc') {
        const catA = a.kategori || 'ZZZ'; // Push empty categories to the end
        const catB = b.kategori || 'ZZZ';
        return catA.localeCompare(catB);
      } else if (sortValue === 'stock_asc') {
        return a.stok - b.stok;
      } else if (sortValue === 'stock_desc') {
        return b.stok - a.stok;
      } else if (sortValue === 'price_asc') {
        return a.harga_jual - b.harga_jual;
      } else if (sortValue === 'price_desc') {
        return b.harga_jual - a.harga_jual;
      }
      return 0; // Default: newest (reverse original order if we assume last added is at the end, but original array is kept as is unless we explicitly reverse it)
    });
    
    // For 'newest', we assume the original array order is oldest first, so we reverse to get newest first. 
    // Actually, new products are pushed to the end of the `products` array.
    if (sortValue === 'newest') {
      matched.reverse();
    }
  }
  
  const totalCount = matched.length;
  
  // Tampilkan keterangan hasil filter
  const countHelpEl = document.getElementById('table-search-count');
  if (searchVal === '') {
    countHelpEl.textContent = `Menampilkan 10 data teratas dari total ${products.length} barang. Gunakan pencarian untuk menyaring barang lain.`;
  } else {
    if (totalCount > 50) {
      countHelpEl.textContent = `Ditemukan ${totalCount} barang yang cocok. Menampilkan 50 barang teratas (ketik kata kunci lebih spesifik untuk mempersempit).`;
    } else {
      countHelpEl.textContent = `Ditemukan ${totalCount} barang yang cocok.`;
    }
  }
  
  // Batasi maksimal 50 barang yang di-render saat pencarian untuk menghindari lag browser (DOM thrashing)
  const itemsToRender = searchVal === '' ? matched.slice(0, 10) : matched.slice(0, 50);
  
  if (itemsToRender.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;">Barang tidak ditemukan.</td></tr>`;
    return;
  }
  
  itemsToRender.forEach((p, index) => {
    // Cari index asli produk di array
    const originalIndex = products.findIndex(prod => prod.id === p.id);
    const tr = document.createElement('tr');
    const imgUrl = p.gambar || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100';
    
    // Tampilkan label kadaluarsa merah jika lewat tanggal, atau orange jika kurang dari 30 hari
    let expBadge = p.tanggal_kadaluarsa || '-';
    if (p.tanggal_kadaluarsa) {
      const expDate = new Date(p.tanggal_kadaluarsa);
      const diffDays = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        expBadge = `<span style="color:var(--color-danger); font-weight:700;">${p.tanggal_kadaluarsa} (KADALUARSA)</span>`;
      } else if (diffDays <= 30) {
        expBadge = `<span style="color:#b45309; font-weight:700;">${p.tanggal_kadaluarsa} (${diffDays} hari lagi)</span>`;
      }
    }
    
    tr.innerHTML = `
      <td style="text-align: center; padding: 0.5rem;">
        <input type="checkbox" class="product-select-checkbox" data-id="${p.id}" onclick="toggleProductSelection('${p.id}', this)" ${selectedProductIds.has(p.id) ? 'checked' : ''} style="cursor: pointer; transform: scale(1.15);">
      </td>
      <td>
        <img src="${imgUrl}" alt="${p.nama}" class="prod-table-img" onerror="handleImageError(this)">
      </td>
      <td><strong>${p.id}</strong></td>
      <td>${p.nama}</td>
      <td><span class="cat-btn" style="cursor:default; margin:0;">${p.kategori || 'Umum'}</span></td>
      <td>Rp ${formatRupiah(p.harga_beli)}</td>
      <td>Rp ${formatRupiah(p.harga_jual)}</td>
      <td>${p.stok}</td>
      <td><span style="font-family: monospace;">${p.barcode || '-'}</span></td>
      <td>${expBadge}</td>
      <td>
        <div style="display: flex; gap: 0.35rem;">
          <button class="action-icon-btn btn-edit" onclick="editProduct(${originalIndex})" title="Edit">
            <svg viewBox="0 0 24 24" class="icon-sm"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button class="action-icon-btn btn-edit" onclick="openPrintLabelModal('${p.id}')" title="Cetak Label Harga" style="color: var(--color-success); background-color: rgba(16,185,129,0.1);">
            <svg viewBox="0 0 24 24" class="icon-sm" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2m-10 0v4h8v-4"/></svg>
          </button>
          <button class="action-icon-btn btn-delete" onclick="deleteProduct(${originalIndex})" title="Hapus">
            <svg viewBox="0 0 24 24" class="icon-sm"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  // Sinkronkan tombol cetak massal dan checkbox master berdasarkan item yang baru saja di-render
  updateBulkActionButtonState();
}

let productListSearchTimeout;
function filterProductListTable() {
  clearTimeout(productListSearchTimeout);
  productListSearchTimeout = setTimeout(() => {
    renderProductsTable();
  }, 250); // Debounce 250ms agar mengetik terasa sangat ringan dan lancar
}

function saveProduct(event) {
  event.preventDefault();
  
  const editIndex = parseInt(document.getElementById('edit-index').value);
  const idInput = document.getElementById('prod-id').value.trim();
  const nameInput = document.getElementById('prod-name').value.trim();
  const categoryInput = document.getElementById('prod-category').value.trim() || 'Umum';
  const priceBuyInput = parseFloat(document.getElementById('prod-price-buy').value) || 0;
  const priceSellInput = parseFloat(document.getElementById('prod-price-sell').value) || 0;
  const stockInput = parseInt(document.getElementById('prod-stock').value) || 0;
  const barcodeInput = document.getElementById('prod-barcode').value.trim();
  const expiryInput = document.getElementById('prod-expiry').value;
  const imageInput = document.getElementById('prod-image').value.trim();
  const promoPriceInput = parseFloat(document.getElementById('prod-promo-price').value) || 0;
  const promoQuotaInput = parseInt(document.getElementById('prod-promo-quota').value) || 0;
  
  if (editIndex === -1) {
    const isDuplicate = products.some(p => p.id.toLowerCase() === idInput.toLowerCase());
    if (isDuplicate) {
      alert(`Gagal! ID Produk "${idInput}" sudah digunakan.`);
      return;
    }
  }
  
  let isPriceIncreased = false;
  let oldPrice = 0;
  if (editIndex > -1) {
    const oldProduct = products[editIndex];
    if (priceSellInput > oldProduct.harga_jual) {
      isPriceIncreased = true;
      oldPrice = oldProduct.harga_jual;
    }
  }
  
  const productData = {
    id: idInput,
    nama: nameInput,
    kategori: categoryInput,
    harga_beli: priceBuyInput,
    harga_jual: priceSellInput,
    stok: stockInput,
    barcode: barcodeInput,
    tanggal_kadaluarsa: expiryInput,
    gambar: imageInput,
    harga_diskon: promoPriceInput,
    kuota_diskon: promoQuotaInput
  };
  
  if (editIndex > -1) {
    products[editIndex] = productData;
  } else {
    products.push(productData);
  }
  
  saveProductsLocally();
  updateCategoriesList();
  renderProductsTable();
  resetProductForm();
  checkPromoBanner();
  
  alert("Produk berhasil disimpan!");
  syncProductsToCloudBackground();
  
  if (isPriceIncreased) {
    showPriceChangeNotification(productData, oldPrice, priceSellInput);
  }
}

function editProduct(index) {
  const p = products[index];
  
  document.getElementById('edit-index').value = index;
  document.getElementById('prod-id').value = p.id;
  document.getElementById('prod-id').disabled = true;
  document.getElementById('prod-name').value = p.nama;
  document.getElementById('prod-category').value = p.kategori || 'Umum';
  document.getElementById('prod-price-buy').value = p.harga_beli || 0;
  document.getElementById('prod-price-sell').value = p.harga_jual || 0;
  document.getElementById('prod-stock').value = p.stok;
  document.getElementById('prod-barcode').value = p.barcode || '';
  document.getElementById('prod-expiry').value = p.tanggal_kadaluarsa || '';
  document.getElementById('prod-image').value = p.gambar || '';
  document.getElementById('prod-promo-price').value = p.harga_diskon || '';
  document.getElementById('prod-promo-quota').value = p.kuota_diskon || '';
  
  document.getElementById('form-title').textContent = "Edit Produk";
  document.getElementById('btn-save-product').textContent = "Perbarui Produk";
  
  // Scroll form ke atas di layar HP agar kasir tahu form siap diisi
  document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth' });
}

function generateNextProductId() {
  if (products.length === 0) {
    return "1001"; // Default start
  }
  
  let maxNum = 0;
  let prefix = "";
  
  products.forEach(p => {
    const matches = p.id.match(/\d+/);
    if (matches) {
      const num = parseInt(matches[0]);
      if (num > maxNum) {
        maxNum = num;
        prefix = p.id.substring(0, p.id.indexOf(matches[0]));
      }
    }
  });
  
  if (maxNum === 0) {
    return "P" + (products.length + 1);
  }
  
  const nextNum = maxNum + 1;
  const origMaxNumStr = maxNum.toString();
  const nextNumStr = nextNum.toString();
  
  if (origMaxNumStr.length > nextNumStr.length) {
    const paddedNum = nextNumStr.padStart(origMaxNumStr.length, '0');
    return prefix + paddedNum;
  }
  
  return prefix + nextNum;
}

function resetProductForm() {
  document.getElementById('edit-index').value = "-1";
  
  const nextId = generateNextProductId();
  const idInput = document.getElementById('prod-id');
  idInput.value = nextId;
  idInput.disabled = false;
  
  document.getElementById('prod-name').value = "";
  document.getElementById('prod-category').value = "";
  document.getElementById('prod-price-buy').value = "";
  document.getElementById('prod-price-sell').value = "";
  document.getElementById('prod-stock').value = "";
  document.getElementById('prod-barcode').value = "";
  document.getElementById('prod-expiry').value = "";
  document.getElementById('prod-image').value = "";
  document.getElementById('prod-promo-price').value = "";
  document.getElementById('prod-promo-quota').value = "";
  
  document.getElementById('form-title').textContent = "Tambah Produk Baru";
  document.getElementById('btn-save-product').textContent = "Simpan Produk";
}

function deleteProduct(index) {
  const p = products[index];
  if (!p) return;
  if (confirm(`Apakah Anda yakin ingin menghapus produk "${p.nama}"?`)) {
    selectedProductIds.delete(p.id);
    products.splice(index, 1);
    saveProductsLocally();
    updateCategoriesList();
    renderProductsTable();
    syncProductsToCloudBackground();
  }
}

// Export Tabel ke Excel (Format CSV)
function exportToCSV() {
  if (products.length === 0) {
    alert("Daftar produk kosong.");
    return;
  }
  
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "ID,Nama Produk,Kategori,Harga Beli,Harga Jual,Stok,Barcode,Gambar,Tanggal Kadaluarsa\n";
  
  products.forEach(p => {
    const row = [
      `"${p.id}"`,
      `"${p.nama}"`,
      `"${p.kategori || 'Umum'}"`,
      p.harga_beli || 0,
      p.harga_jual || 0,
      p.stok,
      `"${p.barcode || ''}"`,
      `"${p.gambar || ''}"`,
      `"${p.tanggal_kadaluarsa || ''}"`
    ].join(",");
    csvContent += row + "\n";
  });
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Data_Produk_KasirKilat_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  
  link.click();
  document.body.removeChild(link);
}

// Kirim data inventaris ke Google Sheets (Mass-Sync - Sangat Cepat!)
async function syncProductsToCloud() {
  if (!gasUrl) {
    alert("Silakan hubungkan aplikasi dengan Google Sheets terlebih dahulu di Pengaturan.");
    return;
  }
  
  if (confirm("Apakah Anda ingin mengganti semua data produk di Google Sheets dengan data lokal saat ini?")) {
    updateSyncStatus('syncing', 'Menyinkronkan produk...');
    const result = await fetchFromGAS('updateProducts', { products: products });
    
    if (result && result.status === 'success') {
      alert("Sinkronisasi massal inventaris produk ke cloud BERHASIL!");
      updateSyncStatus('online', 'Tersinkronisasi');
    } else {
      alert("Gagal menyinkronkan data: " + (result.message || "Koneksi terputus"));
      updateSyncStatus('offline', 'Koneksi Terputus');
    }
  }
}

// --- TAB 5: PENGATURAN KONEKSI ---

function saveGASUrl() {
  const urlInput = document.getElementById('gas-url-input').value.trim();
  
  if (urlInput === '') {
    gasUrl = '';
    localStorage.removeItem('kasir_gas_url');
    updateSyncStatus('offline', 'Belum Terhubung');
    alert("URL koneksi dihapus.");
    return;
  }
  
  if (!urlInput.startsWith('https://script.google.com/')) {
    alert("Format URL salah! Harus berupa URL Google Apps Script Web App.");
    return;
  }
  
  gasUrl = urlInput;
  localStorage.setItem('kasir_gas_url', gasUrl);
  alert("URL koneksi berhasil disimpan!");
  
  testConnection();
}

async function testConnection() {
  if (!gasUrl) {
    alert("URL belum disetel!");
    return;
  }
  
  updateSyncStatus('syncing', 'Menguji koneksi...');
  const result = await fetchFromGAS('getProducts');
  
  if (result && result.status === 'success') {
    updateSyncStatus('online', 'Tersinkronisasi');
    alert("Koneksi BERHASIL! Aplikasi kasir telah terhubung ke Google Sheets.");
    processOfflineQueue();
    syncTransactionsFromCloud();
  } else {
    updateSyncStatus('offline', 'Koneksi Terputus');
    alert("Koneksi GAGAL! Periksa kembali URL Web App Apps Script Anda, dan pastikan Anda sudah men-deploy script dengan akses 'Anyone'.");
  }
}

async function syncFromCloud() {
  if (!gasUrl) return;
  
  updateSyncStatus('syncing', 'Menarik data...');
  const result = await fetchFromGAS('getProducts');
  
  if (result && result.status === 'success') {
    if (result.data && result.data.length > 0) {
      products = result.data.map(p => ({
        id: p.id ? p.id.toString() : '',
        nama: p.nama ? p.nama.toString() : '',
        kategori: p.kategori ? p.kategori.toString() : 'Umum',
        harga_beli: parseFloat(p.harga_beli) || 0,
        harga_jual: parseFloat(p.harga_jual) || 0,
        stok: parseInt(p.stok) || 0,
        barcode: p.barcode ? p.barcode.toString() : '',
        gambar: p.gambar ? p.gambar.toString() : '',
        tanggal_kadaluarsa: p.tanggal_kadaluarsa ? p.tanggal_kadaluarsa.toString().slice(0, 10) : ''
      }));
      
      saveProductsLocally();
      updateCategoriesList();
      
      renderCart();
      renderProductsTable();
      updateAnalytics();
      updateSyncStatus('online', 'Tersinkronisasi');
    }
  } else {
    updateSyncStatus('offline', 'Koneksi Terputus');
  }
}

function clearLocalCache() {
  if (confirm("Apakah Anda yakin ingin menghapus seluruh cache lokal? Ini akan menghapus data URL, produk lokal, riwayat transaksi, pengaturan struk, dan antrean transaksi offline.")) {
    localStorage.clear();
    products = [...defaultProducts];
    cart = [];
    transactions = seedTransactions();
    gasUrl = '';
    offlineQueue = [];
    activeCategory = 'All';
    selectedProductIds.clear();
    receiptSettings = {
      logo: '',
      name: 'KasirKilat',
      phone: '0812-3456-7890',
      address: 'Jl. Utama No. 123, Indonesia',
      fontSize: 12
    };
    
    document.getElementById('gas-url-input').value = '';
    
    saveProductsLocally();
    localStorage.setItem('kasir_transactions', JSON.stringify(transactions));
    localStorage.setItem('kasir_receipt_settings', JSON.stringify(receiptSettings));
    
    loadReceiptSettings();
    renderCart();
    renderProductsTable();
    updateAnalytics();
    resetProductForm();
    
    updateSyncStatus('offline', 'Belum Terhubung');
    alert("Cache lokal berhasil dibersihkan!");
  }
}

// --- LOGIKA KASIR MULTI-USER (FITUR BARU) ---
function initCashiers() {
  const selectSelect = document.getElementById('active-cashier-select');
  if (selectSelect) {
    selectSelect.innerHTML = '';
    cashiers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c === activeCashier) opt.selected = true;
      selectSelect.appendChild(opt);
    });
  }
  renderCashierSettingsList();
}

function setActiveCashier(name) {
  activeCashier = name;
  localStorage.setItem('kasir_active_cashier', name);
  initCashiers(); // Render ulang daftar pengaturan agar label (Aktif) ter-update
}

function renderCashierSettingsList() {
  const listContainer = document.getElementById('cashier-settings-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';
  
  cashiers.forEach(c => {
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.justify = 'space-between';
    item.style.alignItems = 'center';
    item.style.padding = '0.35rem 0.5rem';
    item.style.backgroundColor = 'var(--bg-card)';
    item.style.border = '1px solid var(--border-color)';
    item.style.borderRadius = 'var(--border-radius-sm)';
    item.style.marginBottom = '0.25rem';
    
    // Jangan izinkan hapus jika hanya ada 1 kasir tersisa
    const deleteBtnHtml = cashiers.length > 1 
      ? `<button class="action-icon-btn btn-delete" onclick="deleteCashier('${c}')" title="Hapus Kasir" style="padding: 2px 4px;">
           <svg viewBox="0 0 24 24" class="icon-sm" style="width:14px; height:14px;"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
         </button>` 
      : '';
      
    const editBtnHtml = `<button class="action-icon-btn btn-edit" onclick="renameCashier('${c}')" title="Ubah Nama Kasir" style="padding: 2px 4px; color: var(--color-primary); background-color: rgba(59,130,246,0.1);">
                           <svg viewBox="0 0 24 24" class="icon-sm" style="width:14px; height:14px;"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                         </button>`;
      
    item.innerHTML = `
      <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">${c} ${c === activeCashier ? '<small style="color:var(--color-success); font-weight:700; margin-left:0.25rem;">(Aktif)</small>' : ''}</span>
      <div style="display: flex; gap: 0.35rem; align-items: center;">
        ${editBtnHtml}
        ${deleteBtnHtml}
      </div>
    `;
    listContainer.appendChild(item);
  });
}

function addCashier() {
  const input = document.getElementById('new-cashier-name');
  const name = input.value.trim();
  if (name === '') {
    alert("Nama kasir tidak boleh kosong!");
    return;
  }
  if (cashiers.includes(name)) {
    alert("Nama kasir sudah ada!");
    return;
  }
  
  cashiers.push(name);
  localStorage.setItem('kasir_cashiers', JSON.stringify(cashiers));
  input.value = '';
  
  initCashiers();
  alert(`Kasir "${name}" berhasil ditambahkan!`);
}

function deleteCashier(name) {
  if (confirm(`Apakah Anda yakin ingin menghapus kasir "${name}"?`)) {
    cashiers = cashiers.filter(c => c !== name);
    localStorage.setItem('kasir_cashiers', JSON.stringify(cashiers));
    
    if (activeCashier === name) {
      activeCashier = cashiers[0];
      localStorage.setItem('kasir_active_cashier', activeCashier);
    }
    
    initCashiers();
    alert(`Kasir "${name}" berhasil dihapus.`);
  }
}

function renameCashier(oldName) {
  const newName = prompt(`Ubah nama kasir "${oldName}" menjadi:`, oldName);
  if (newName === null) return; // Batal
  const cleanName = newName.trim();
  if (cleanName === '') {
    alert("Nama kasir tidak boleh kosong!");
    return;
  }
  if (cleanName === oldName) return;
  if (cashiers.includes(cleanName)) {
    alert("Nama kasir sudah terdaftar!");
    return;
  }
  
  const idx = cashiers.indexOf(oldName);
  if (idx !== -1) {
    cashiers[idx] = cleanName;
    localStorage.setItem('kasir_cashiers', JSON.stringify(cashiers));
    
    if (activeCashier === oldName) {
      activeCashier = cleanName;
      localStorage.setItem('kasir_active_cashier', activeCashier);
    }
    
    initCashiers();
    alert(`Nama kasir "${oldName}" berhasil diubah menjadi "${cleanName}".`);
  }
}

// --- PINTASAN KEYBOARD GLOBAL ---

function handleGlobalKeydowns(e) {
  const paymentModal = document.getElementById('payment-modal');
  const receiptModal = document.getElementById('receipt-modal');
  
  const isPaymentOpen = paymentModal.classList.contains('active');
  const isReceiptOpen = receiptModal.classList.contains('active');
  
  // Modals have global priority across all tabs
  if (isReceiptOpen || isPaymentOpen) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (isReceiptOpen) closeReceiptModal();
      else if (isPaymentOpen) closePaymentModal();
      return;
    }
    
    if (isReceiptOpen) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        selectedReceiptButtonIndex = 0;
        updateReceiptButtonsHighlight();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        selectedReceiptButtonIndex = 1;
        updateReceiptButtonsHighlight();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedReceiptButtonIndex === 0) triggerPrintReceipt();
        else closeReceiptModal();
        return;
      }
    } else if (isPaymentOpen) {
      if (e.key === 'Shift' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setQuickCash('pass');
        return;
      }
      if (e.key === 'Enter') {
        const btnSubmit = document.getElementById('btn-submit-payment');
        if (btnSubmit && !btnSubmit.disabled) {
          e.preventDefault();
          processCheckout();
        }
        return;
      }
    }
  }
  
  // Non-modal shortcuts are POS-only
  if (activeTab !== 'pos') return;
  
  if (e.key === 'Escape') {
    e.preventDefault();
    if (cart.length > 0) {
      clearCart();
    }
    return;
  }
  
  if (e.key === 'Shift' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    if (cart.length > 0) {
      e.preventDefault();
      openPaymentModal();
    }
    return;
  }
  
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
    
    const cartList = document.getElementById('cart-list');
    if (cartList && cart.length > 0) {
      e.preventDefault();
      const scrollAmount = 50;
      if (e.key === 'ArrowDown') {
        cartList.scrollTop += scrollAmount;
      } else {
        cartList.scrollTop -= scrollAmount;
      }
    }
  }

}

// --- UTILITY FUNCTIONS ---
function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID').format(number);
}

// --- Generator Barcode Code 39 Offline ---
const CODE39_MAP = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100'
};

function generateCode39SVG(text) {
  if (!text) return '';
  const cleanText = text.toUpperCase().split('').filter(c => CODE39_MAP[c]).join('');
  if (!cleanText) return '';

  const fullText = '*' + cleanText + '*';
  const N_WIDTH = 2.0; 
  const W_WIDTH = 5.0; 
  const GAP = 2.0;     
  const height = 45;   

  let currentX = 0;
  const rects = [];

  for (let i = 0; i < fullText.length; i++) {
    const char = fullText[i];
    const pattern = CODE39_MAP[char];

    for (let j = 0; j < 9; j++) {
      const isWide = pattern[j] === '1';
      const width = isWide ? W_WIDTH : N_WIDTH;
      const isBar = j % 2 === 0;

      if (isBar) {
        rects.push(`<rect x="${currentX.toFixed(1)}" y="0" width="${width.toFixed(1)}" height="${height}" fill="black" />`);
      }
      currentX += width;
    }
    currentX += GAP;
  }

  return `<svg width="${currentX.toFixed(1)}" height="${height}" viewBox="0 0 ${currentX.toFixed(1)} ${height}" xmlns="http://www.w3.org/2000/svg">${rects.join('')}</svg>`;
}

// State Riwayat Transaksi & Edit Transaksi
let editTxItems = [];
let editTxOriginalItems = [];
let editTxFilteredProducts = [];
let selectedEditTxFloatIndex = -1;
let currentEditingTxId = null;

function renderTransactionsTable() {
  const tbody = document.getElementById('transactions-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const searchVal = document.getElementById('transaction-list-search').value.toLowerCase().trim();
  const statusFilter = document.getElementById('tx-filter-status').value;
  
  // Urutkan transaksi dari yang terbaru ke terlama
  const sortedTxs = [...transactions].sort((a, b) => {
    return new Date(b.waktu) - new Date(a.waktu);
  });
  
  const startDateVal = document.getElementById('tx-filter-start-date').value;
  const endDateVal = document.getElementById('tx-filter-end-date').value;
  
  let startLimit = startDateVal ? new Date(startDateVal + "T00:00:00") : null;
  let endLimit = endDateVal ? new Date(endDateVal + "T23:59:59") : null;
  
  const filteredTxs = sortedTxs.filter(tx => {
    const itemsStr = Array.isArray(tx.items) 
      ? tx.items.map(item => item.nama).join(" ").toLowerCase()
      : (tx.daftar_item || tx.items || "").toLowerCase();
      
    const waktuStr = new Date(tx.waktu).toLocaleString('id-ID').toLowerCase();
    
    const matchesSearch = tx.id.toLowerCase().includes(searchVal) || 
                          waktuStr.includes(searchVal) ||
                          itemsStr.includes(searchVal) ||
                          tx.total.toString().includes(searchVal);
                          
    if (!matchesSearch) return false;
    
    // Filter status pembayaran
    if (statusFilter === 'Lunas' && tx.status_pembayaran === 'Bon') return false;
    if (statusFilter === 'Bon' && tx.status_pembayaran !== 'Bon') return false;
    
    if (tx.waktu) {
      const txDate = new Date(tx.waktu);
      if (startLimit && txDate < startLimit) return false;
      if (endLimit && txDate > endLimit) return false;
    }
    
    return true;
  });
  
  const countHelpEl = document.getElementById('transaction-search-count');
  if (countHelpEl) {
    countHelpEl.textContent = `Ditemukan ${filteredTxs.length} transaksi.`;
  }
  
  if (filteredTxs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Tidak ada transaksi ditemukan.</td></tr>`;
    return;
  }
  
  filteredTxs.forEach(tx => {
    const tr = document.createElement('tr');
    
    let itemsDisplay = "";
    if (Array.isArray(tx.items)) {
      itemsDisplay = tx.items.map(item => `${item.nama} (${item.qty}x)`).join(", ");
    } else {
      itemsDisplay = tx.daftar_item || tx.items || "";
    }
    
    const timeStr = new Date(tx.waktu).toLocaleString('id-ID', { hour12: false });
    
    // Status Pembayaran badge & kembalian display
    let statusBadge = '';
    let changeOrDebtDisplay = '';
    let settleBtnHtml = '';
    
    if (tx.status_pembayaran === 'Bon') {
      statusBadge = `<span class="cat-btn" style="background-color: rgba(239,68,68,0.1); color: var(--color-danger); border-color: rgba(239,68,68,0.2); cursor: default; margin: 0; font-size: 0.75rem;">Bon</span>`;
      changeOrDebtDisplay = `<span style="color: var(--color-danger); font-weight: 700;">Sisa: Rp ${formatRupiah(tx.sisa_piutang)}</span>`;
      if (tx.sisa_piutang > 0) {
        settleBtnHtml = `
          <button class="action-icon-btn btn-edit" onclick="openSettleDebtModal('${tx.id}')" title="Pelunasan Bon" style="color: var(--color-success); background-color: rgba(16,185,129,0.1);">
            <svg viewBox="0 0 24 24" class="icon-sm" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </button>
        `;
      }
    } else {
      statusBadge = `<span class="cat-btn" style="background-color: rgba(16,185,129,0.1); color: var(--color-success); border-color: rgba(16,185,129,0.2); cursor: default; margin: 0; font-size: 0.75rem;">Lunas</span>`;
      changeOrDebtDisplay = `<span style="color: var(--color-success); font-weight: 700;">Rp ${formatRupiah(tx.kembalian)}</span>`;
    }
    
    const customerDisplay = tx.nama_pelanggan ? `<br><small style="color: var(--text-muted); font-size: 0.75rem;">Pelanggan: <strong>${tx.nama_pelanggan}</strong></small>` : '';
    
    tr.innerHTML = `
      <td><strong>${tx.id}</strong>${customerDisplay}</td>
      <td>${timeStr}</td>
      <td><span style="font-weight: 600; font-size: 0.85rem;">${tx.kasir || 'Kasir Utama'}</span></td>
      <td><span class="text-muted" style="font-size: 0.8rem;">${itemsDisplay}</span></td>
      <td style="font-weight: 700;">Rp ${formatRupiah(tx.total)}</td>
      <td><span style="font-size: 0.85rem; display: flex; align-items: center; gap: 0.25rem;">${tx.metode_pembayaran || 'Tunai'} ${statusBadge}</span></td>
      <td>Rp ${formatRupiah(tx.bayar)}</td>
      <td>${changeOrDebtDisplay}</td>
      <td>
        <div style="display: flex; gap: 0.35rem;">
          ${settleBtnHtml}
          <button class="action-icon-btn btn-edit" onclick="openEditTransactionModal('${tx.id}')" title="Edit Transaksi">
            <svg viewBox="0 0 24 24" class="icon-sm"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button class="action-icon-btn btn-edit" onclick="reprintReceipt('${tx.id}')" title="Cetak Uang / Reprint Nota" style="color: var(--color-primary); background-color: rgba(202,138,4,0.1);">
            <svg viewBox="0 0 24 24" class="icon-sm" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2m-10 0v4h8v-4"/></svg>
          </button>
          <button class="action-icon-btn btn-delete" onclick="deleteTransaction('${tx.id}')" title="Hapus Transaksi">
            <svg viewBox="0 0 24 24" class="icon-sm"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterTransactionsTable() {
  renderTransactionsTable();
}

function deleteTransaction(txId) {
  if (confirm(`Apakah Anda yakin ingin menghapus transaksi "${txId}"? Tindakan ini akan mengembalikan stok barang ke inventaris.`)) {
    const txIndex = transactions.findIndex(t => t.id === txId);
    if (txIndex === -1) {
      alert("Transaksi tidak ditemukan!");
      return;
    }
    
    const tx = transactions[txIndex];
    
    // Kembalikan stok untuk semua barang di transaksi ini
    if (Array.isArray(tx.items)) {
      tx.items.forEach(item => {
        const product = products.find(p => p.id === item.id);
        if (product) {
          product.stok += item.qty;
          if (item.isPromo) {
            product.kuota_diskon = (parseInt(product.kuota_diskon) || 0) + item.qty;
          }
        }
      });
    }
    
    // Hapus transaksi dari cache lokal
    transactions.splice(txIndex, 1);
    
    // Simpan data
    saveProductsLocally();
    localStorage.setItem('kasir_transactions', JSON.stringify(transactions));
    
    // Render ulang UI
    renderTransactionsTable();
    renderProductsTable();
    updateAnalytics();
    
    // Sinkronkan ke cloud
    syncProductsToCloudBackground();
    syncTransactionsToCloudBackground();
    
    alert(`Transaksi ${txId} berhasil dihapus dan stok barang dikembalikan.`);
  }
}

function reprintReceipt(txId) {
  const tx = transactions.find(t => t.id === txId);
  if (!tx) {
    alert("Transaksi tidak ditemukan!");
    return;
  }
  showReceipt(tx, tx.items || []);
}

function openEditTransactionModal(txId) {
  const tx = transactions.find(t => t.id === txId);
  if (!tx) {
    alert("Transaksi tidak ditemukan!");
    return;
  }
  
  currentEditingTxId = txId;
  document.getElementById('edit-tx-id-title').textContent = txId;
  
  // Clone data transaksi dan pastikan cartId ada
  editTxItems = JSON.parse(JSON.stringify(tx.items || [])).map(item => {
    if (!item.cartId) item.cartId = item.id + (item.isPromo ? '_promo' : '_reguler');
    return item;
  });
  editTxOriginalItems = JSON.parse(JSON.stringify(editTxItems));
  
  // Set metode pembayaran
  const metode = tx.metode_pembayaran || 'Tunai';
  const methodSelect = document.getElementById('edit-tx-payment-method');
  if (methodSelect) methodSelect.value = metode;
  
  // Tampilkan/sembunyikan seksi cash berdasarkan metode
  const cashSection = document.getElementById('edit-tx-cash-section');
  const nonCashMethods = ['QRIS', 'Transfer', 'Debit'];
  if (cashSection) cashSection.style.display = nonCashMethods.includes(metode) ? 'none' : 'block';
  
  // Set nilai uang bayar terformat
  const cashInput = document.getElementById('edit-tx-cash-received');
  cashInput.value = formatRupiah(tx.bayar);
  
  document.getElementById('edit-tx-search-input').value = '';
  closeEditTxFloatingResults();
  
  renderEditTxItems();
  
  document.getElementById('edit-transaction-modal').classList.add('active');
}

function closeEditTransactionModal() {
  document.getElementById('edit-transaction-modal').classList.remove('active');
  currentEditingTxId = null;
  editTxItems = [];
  editTxOriginalItems = [];
}

function renderEditTxItems() {
  const container = document.getElementById('edit-tx-items-list');
  if (!container) return;
  container.innerHTML = '';
  
  let total = 0;
  
  if (editTxItems.length === 0) {
    container.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-muted);">Tidak ada barang belanjaan. Silakan cari dan tambahkan barang.</div>';
    document.getElementById('edit-tx-total-amount').textContent = 'Rp 0';
    document.getElementById('edit-tx-change-amount').textContent = 'Rp 0';
    return;
  }
  
  editTxItems.forEach(item => {
    const subtotal = item.harga * item.qty;
    total += subtotal;
    
    const div = document.createElement('div');
    div.className = 'edit-tx-item-row';
    div.innerHTML = `
      <div class="edit-tx-item-info">
        <div class="edit-tx-item-name">${item.nama}</div>
        <div class="edit-tx-item-price">Rp ${formatRupiah(item.harga)}</div>
      </div>
      <div class="edit-tx-item-controls">
        <input type="number" class="edit-tx-qty-input" value="${item.qty}" min="1" onchange="updateEditTxQty('${item.cartId}', this.value)">
        <span class="edit-tx-item-subtotal">Rp ${formatRupiah(subtotal)}</span>
        <button class="remove-item-btn" onclick="removeEditTxItem('${item.cartId}')" style="margin-left: 0.5rem;">
          <svg viewBox="0 0 24 24" class="icon-sm"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
        </button>
      </div>
    `;
    container.appendChild(div);
  });
  
  document.getElementById('edit-tx-total-amount').textContent = `Rp ${formatRupiah(total)}`;
  calculateChangeEditTx();
}

function updateEditTxQty(cartId, value) {
  const qty = parseInt(value) || 1;
  const item = editTxItems.find(it => it.cartId === cartId);
  if (!item) return;
  const baseId = item.id;
  
  let totalQty = editTxItems.filter(i => i.id === baseId).reduce((sum, i) => sum + i.qty, 0);
  totalQty = totalQty - item.qty + qty;
  
  recalculateEditTxSplit(baseId, totalQty);
}

function removeEditTxItem(cartId) {
  const item = editTxItems.find(it => it.cartId === cartId);
  if (!item) return;
  const baseId = item.id;
  
  let totalQty = editTxItems.filter(i => i.id === baseId).reduce((sum, i) => sum + i.qty, 0);
  totalQty -= item.qty;
  
  recalculateEditTxSplit(baseId, totalQty);
}

function filterEditTxSearch() {
  const input = document.getElementById('edit-tx-search-input');
  const val = input.value.toLowerCase().trim();
  const dropdown = document.getElementById('edit-tx-floating-results');
  
  if (val === '') {
    closeEditTxFloatingResults();
    return;
  }
  
  editTxFilteredProducts = products.filter(p => {
    return p.nama.toLowerCase().includes(val) || 
           p.id.toLowerCase().includes(val) ||
           (p.barcode && p.barcode.toLowerCase().includes(val));
  }).slice(0, 15);
  
  if (editTxFilteredProducts.length === 0) {
    dropdown.innerHTML = '<div style="padding: 0.75rem 1rem; color: var(--text-muted); font-size: 0.85rem;">Barang tidak ditemukan...</div>';
    dropdown.classList.add('active');
    selectedEditTxFloatIndex = -1;
    return;
  }
  
  selectedEditTxFloatIndex = 0;
  renderEditTxFloatingDropdown();
}

function renderEditTxFloatingDropdown() {
  const dropdown = document.getElementById('edit-tx-floating-results');
  dropdown.innerHTML = '';
  dropdown.classList.add('active');
  
  editTxFilteredProducts.forEach((p, index) => {
    const isSelected = index === selectedEditTxFloatIndex;
    const isOutOfStock = p.stok <= 0;
    
    const div = document.createElement('div');
    div.className = `floating-item ${isSelected ? 'selected' : ''} ${isOutOfStock ? 'out-of-stock' : ''}`;
    div.onclick = () => {
      if (!isOutOfStock) {
        addEditTxItem(p);
      } else {
        alert("Stok barang habis!");
      }
    };
    
    const imgUrl = p.gambar || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100';
    
    div.innerHTML = `
      <img src="${imgUrl}" alt="${p.nama}" class="floating-item-img" onerror="handleImageError(this)">
      <div class="floating-item-info">
        <span class="floating-item-name">${p.nama} (${p.id})</span>
        <div class="floating-item-meta">
          <span class="floating-item-price">Rp ${formatRupiah(p.harga_jual)}</span>
          <span class="floating-item-stock">Stok: ${p.stok}</span>
        </div>
      </div>
    `;
    dropdown.appendChild(div);
  });
  
  const selectedEl = dropdown.querySelector('.floating-item.selected');
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: 'nearest' });
  }
}

function closeEditTxFloatingResults() {
  const dropdown = document.getElementById('edit-tx-floating-results');
  if (dropdown) dropdown.classList.remove('active');
  editTxFilteredProducts = [];
  selectedEditTxFloatIndex = -1;
}

function handleEditTxSearchInputKeydowns(e) {
  if (editTxFilteredProducts.length === 0) return;
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedEditTxFloatIndex = (selectedEditTxFloatIndex + 1) % editTxFilteredProducts.length;
    renderEditTxFloatingDropdown();
  } 
  else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedEditTxFloatIndex = (selectedEditTxFloatIndex - 1 + editTxFilteredProducts.length) % editTxFilteredProducts.length;
    renderEditTxFloatingDropdown();
  } 
  else if (e.key === 'Enter') {
    e.preventDefault();
    if (selectedEditTxFloatIndex > -1 && selectedEditTxFloatIndex < editTxFilteredProducts.length) {
      const prod = editTxFilteredProducts[selectedEditTxFloatIndex];
      if (prod.stok > 0) {
        addEditTxItem(prod);
      } else {
        alert("Stok barang habis!");
      }
    }
  }
}

function addEditTxItem(product) {
  let totalQty = editTxItems.filter(i => i.id === product.id).reduce((sum, i) => sum + i.qty, 0);
  totalQty += 1;
  recalculateEditTxSplit(product.id, totalQty);
  
  document.getElementById('edit-tx-search-input').value = '';
  closeEditTxFloatingResults();
}

function recalculateEditTxSplit(baseId, totalQty) {
  // Hapus semua item lama dengan baseId yang sama
  editTxItems = editTxItems.filter(i => i.id !== baseId);
  
  if (totalQty <= 0) {
    renderEditTxItems();
    return;
  }
  
  const localProd = products.find(p => p.id === baseId);
  if (!localProd) return;
  
  const origItems = editTxOriginalItems.filter(it => it.id === baseId);
  const origQty = origItems.reduce((sum, it) => sum + it.qty, 0);
  const maxAvailable = localProd.stok + origQty;
  
  if (totalQty > maxAvailable && !appConfig.allowZeroStock) {
    alert(`Stok tidak mencukupi! Batas maksimum untuk barang ini adalah ${maxAvailable} pcs (Stok tersisa + Kuantitas asli).`);
    totalQty = maxAvailable;
  }
  
  const hargaDiskon = parseFloat(localProd.harga_diskon) || 0;
  let origPromoQty = 0;
  origItems.forEach(it => {
    if (it.isPromo) origPromoQty += it.qty;
  });
  
  const totalKuotaTersedia = (parseInt(localProd.kuota_diskon) || 0) + origPromoQty;
  const kuotaDiskon = totalKuotaTersedia > 0 ? totalKuotaTersedia : Infinity;
  const hasPromo = appConfig.enablePromo && hargaDiskon > 0;
  
  if (hasPromo && totalKuotaTersedia > 0) {
    const promoQty = Math.min(totalQty, kuotaDiskon);
    const regQty = totalQty - promoQty;
    
    if (promoQty > 0) {
      editTxItems.push({
        id: baseId,
        cartId: baseId + '_promo',
        nama: localProd.nama + ' (Promo)',
        harga: hargaDiskon,
        harga_beli: parseFloat(localProd.harga_beli) || 0,
        qty: promoQty,
        isPromo: true
      });
    }
    
    if (regQty > 0) {
      editTxItems.push({
        id: baseId,
        cartId: baseId + '_reguler',
        nama: localProd.nama,
        harga: localProd.harga_jual,
        harga_beli: parseFloat(localProd.harga_beli) || 0,
        qty: regQty,
        isPromo: false
      });
    }
  } else {
    editTxItems.push({
      id: baseId,
      cartId: baseId + '_reguler',
      nama: localProd.nama,
      harga: localProd.harga_jual,
      harga_beli: parseFloat(localProd.harga_beli) || 0,
      qty: totalQty,
      isPromo: false
    });
  }
  
  renderEditTxItems();
}

function formatAndCalculateChangeEditTx() {
  const input = document.getElementById('edit-tx-cash-received');
  const cleanVal = input.value.replace(/\D/g, "");
  if (cleanVal === "") {
    input.value = "";
  } else {
    input.value = new Intl.NumberFormat('id-ID').format(cleanVal);
  }
  calculateChangeEditTx();
}

function onEditTxPaymentMethodChange(value) {
  const nonCashMethods = ['QRIS', 'Transfer', 'Debit'];
  const cashSection = document.getElementById('edit-tx-cash-section');
  if (cashSection) cashSection.style.display = nonCashMethods.includes(value) ? 'none' : 'block';
  calculateChangeEditTx();
}

function calculateChangeEditTx() {
  const cashInput = document.getElementById('edit-tx-cash-received');
  const changeVal = document.getElementById('edit-tx-change-amount');
  const btnSave = document.getElementById('btn-save-edited-tx');
  
  let total = 0;
  editTxItems.forEach(item => {
    total += item.harga * item.qty;
  });
  
  // Cek apakah metode non-tunai (tidak perlu hitung kembalian)
  const metode = document.getElementById('edit-tx-payment-method')?.value || 'Tunai';
  const nonCashMethods = ['QRIS', 'Transfer', 'Debit'];
  if (nonCashMethods.includes(metode)) {
    // Non-cash: langsung enable tombol simpan
    btnSave.disabled = false;
    return;
  }
  
  const cashText = cashInput.value.replace(/\./g, "");
  const cash = parseFloat(cashText) || 0;
  const change = cash - total;
  
  if (cashInput.value === '') {
    changeVal.textContent = 'Rp 0';
    changeVal.style.color = 'var(--text-muted)';
    btnSave.disabled = true;
  } else if (change >= 0) {
    changeVal.textContent = `Rp ${formatRupiah(change)}`;
    changeVal.style.color = 'var(--color-success)';
    btnSave.disabled = false;
  } else {
    changeVal.textContent = `Kurang Rp ${formatRupiah(Math.abs(change))}`;
    changeVal.style.color = 'var(--color-danger)';
    btnSave.disabled = true;
  }
}

function saveEditedTransaction() {
  if (editTxItems.length === 0) {
    alert("Daftar barang belanjaan tidak boleh kosong!");
    return;
  }
  
  // Baca metode pembayaran
  const metode = document.getElementById('edit-tx-payment-method')?.value || 'Tunai';
  const nonCashMethods = ['QRIS', 'Transfer', 'Debit'];
  const isNonCash = nonCashMethods.includes(metode);
  
  let total = 0;
  editTxItems.forEach(item => {
    total += item.harga * item.qty;
  });
  
  let cash = total; // untuk non-cash, bayar = total (tidak ada kembalian)
  let kembalian = 0;
  
  const tx = transactions.find(t => t.id === currentEditingTxId);
  if (!tx) {
    alert("Transaksi tidak ditemukan!");
    return;
  }
  
  if (!isNonCash) {
    const cashInput = document.getElementById('edit-tx-cash-received');
    const cashText = cashInput.value.replace(/\./g, "");
    cash = parseFloat(cashText) || 0;
    
    if (tx.status_pembayaran !== 'Bon' && cash < total) {
      alert("Pembayaran kurang!");
      return;
    }
    kembalian = cash >= total ? cash - total : 0;
  }
  
  // Update stok produk
  const allProductIds = new Set([
    ...editTxOriginalItems.map(it => it.id),
    ...editTxItems.map(it => it.id)
  ]);
  
  allProductIds.forEach(id => {
    const origItem = editTxOriginalItems.find(it => it.id === id);
    const newItem = editTxItems.find(it => it.id === id);
    
    const origQty = origItem ? origItem.qty : 0;
    const newQty = newItem ? newItem.qty : 0;
    const delta = newQty - origQty;
    
    if (delta !== 0) {
      const product = products.find(p => p.id === id);
      if (product) {
        product.stok = Math.max(0, product.stok - delta);
        if ((origItem && origItem.isPromo) || (newItem && newItem.isPromo)) {
          let prevKuota = parseInt(product.kuota_diskon) || 0;
          if (prevKuota > 0) {
            product.kuota_diskon = Math.max(0, prevKuota - delta);
            if (product.kuota_diskon === 0) {
              product.harga_diskon = 0;
            }
          }
        }
      }
    }
  });
  
  tx.items = [...editTxItems];
  tx.total = total;
  tx.bayar = cash;
  tx.kembalian = kembalian;
  tx.metode_pembayaran = metode;
  
  if (isNonCash) {
    tx.sisa_piutang = 0;
    tx.status_pembayaran = 'Lunas';
  } else {
    tx.sisa_piutang = cash < total ? total - cash : 0;
    tx.status_pembayaran = tx.sisa_piutang > 0 ? 'Bon' : 'Lunas';
  }
  
  saveProductsLocally();
  localStorage.setItem('kasir_transactions', JSON.stringify(transactions));
  
  closeEditTransactionModal();
  renderTransactionsTable();
  renderProductsTable();
  updateAnalytics();
  
  syncProductsToCloudBackground();
  syncTransactionsToCloudBackground();
  
  alert("Transaksi berhasil diperbarui!");
}

async function syncTransactionsToCloud() {
  if (!gasUrl) {
    alert("Silakan hubungkan aplikasi dengan Google Sheets terlebih dahulu di Pengaturan.");
    return;
  }
  
  if (confirm("Apakah Anda ingin mengganti semua data transaksi di Google Sheets dengan data lokal saat ini?")) {
    updateSyncStatus('syncing', 'Menyinkronkan transaksi...');
    const result = await fetchFromGAS('updateTransactions', { transactions: transactions });
    
    if (result && result.status === 'success') {
      alert("Sinkronisasi massal transaksi ke cloud BERHASIL!");
      updateSyncStatus('online', 'Tersinkronisasi');
    } else {
      alert("Gagal menyinkronkan data: " + (result.message || "Koneksi terputus"));
      updateSyncStatus('offline', 'Koneksi Terputus');
    }
  }
}

async function syncTransactionsToCloudBackground() {
  if (!gasUrl) return;
  updateSyncStatus('syncing', 'Menyinkronkan transaksi...');
  const result = await fetchFromGAS('updateTransactions', { transactions: transactions });
  if (result && result.status === 'success') {
    updateSyncStatus('online', 'Tersinkronisasi');
  } else {
    updateSyncStatus('offline', 'Koneksi Terputus');
  }
}

async function syncTransactionsFromCloud() {
  if (!gasUrl) return;
  
  updateSyncStatus('syncing', 'Menarik transaksi...');
  const result = await fetchFromGAS('getTransactions');
  
  if (result && result.status === 'success') {
    if (result.data) {
      // Simpan data lokal sebagai referensi untuk merge piutang
      const localTxMap = {};
      transactions.forEach(ltx => {
        localTxMap[ltx.id] = ltx;
      });
      
      transactions = result.data.map(tx => {
        let itemsList = [];
        const itemsStr = tx.daftar_item || tx.items || "";
        if (itemsStr) {
          const parts = itemsStr.split(", ");
          parts.forEach(part => {
            const match = part.match(/(.+) \((\d+)x @(\d+)\)/);
            if (match) {
              const nama = match[1].trim();
              const qty = parseInt(match[2]) || 1;
              const harga = parseFloat(match[3]) || 0;
              
              const prod = products.find(p => p.nama.toLowerCase() === nama.toLowerCase());
              itemsList.push({
                id: prod ? prod.id : '',
                nama: nama,
                harga: harga,
                harga_beli: prod ? prod.harga_beli : Math.round(harga * 0.7),
                qty: qty
              });
            }
          });
        }
        
        const txId = tx.id_transaksi ? tx.id_transaksi.toString() : (tx.id ? tx.id.toString() : '');
        
        // Ambil data piutang dari cloud
        const cloudSisa = parseFloat(tx.sisa_piutang) || 0;
        const cloudStatus = tx.status_pembayaran || '';
        const cloudCustomer = tx.nama_pelanggan || '';
        
        // Cek data lokal sebagai referensi merge
        const localTx = localTxMap[txId];
        
        // Tentukan sisa_piutang: prioritaskan data lokal jika cloud kosong
        let finalSisa = cloudSisa;
        let finalStatus = '';
        let finalCustomer = cloudCustomer;
        
        if (localTx) {
          // Ada data lokal — jika cloud tidak punya info piutang, pakai lokal
          if (cloudSisa === 0 && cloudStatus === '' && localTx.sisa_piutang > 0) {
            finalSisa = localTx.sisa_piutang;
          }
          if (!cloudCustomer && localTx.nama_pelanggan) {
            finalCustomer = localTx.nama_pelanggan;
          }
          if (!cloudStatus && localTx.status_pembayaran) {
            finalStatus = localTx.status_pembayaran;
          }
        }
        
        // Tentukan status akhir: sisa_piutang > 0 = pasti Bon
        if (!finalStatus) {
          finalStatus = finalSisa > 0 ? 'Bon' : (cloudStatus || 'Lunas');
        }
        if (finalSisa > 0) {
          finalStatus = 'Bon';
        }
        
        return {
          id: txId,
          waktu: tx.waktu || '',
          items: itemsList,
          total: parseFloat(tx.total) || 0,
          bayar: parseFloat(tx.uang_bayar) || parseFloat(tx.bayar) || 0,
          kembalian: parseFloat(tx.kembalian) || 0,
          metode_pembayaran: tx.metode_pembayaran || "Tunai",
          kasir: tx.kasir || "Kasir Utama",
          sisa_piutang: finalSisa,
          nama_pelanggan: finalCustomer,
          status_pembayaran: finalStatus
        };
      });
      
      localStorage.setItem('kasir_transactions', JSON.stringify(transactions));
      renderTransactionsTable();
      initAnalyticsFilter();
      updateAnalytics();
      updateSyncStatus('online', 'Tersinkronisasi');
    }
  } else {
    updateSyncStatus('offline', 'Koneksi Terputus');
  }
}

function clearTransactionFilters() {
  document.getElementById('transaction-list-search').value = '';
  document.getElementById('tx-filter-start-date').value = '';
  document.getElementById('tx-filter-end-date').value = '';
  renderTransactionsTable();
}

function exportTransactionsToCSV() {
  const searchVal = document.getElementById('transaction-list-search').value.toLowerCase().trim();
  const startDateVal = document.getElementById('tx-filter-start-date').value;
  const endDateVal = document.getElementById('tx-filter-end-date').value;
  
  let startLimit = startDateVal ? new Date(startDateVal + "T00:00:00") : null;
  let endLimit = endDateVal ? new Date(endDateVal + "T23:59:59") : null;
  
  const sortedTxs = [...transactions].sort((a, b) => {
    return new Date(b.waktu) - new Date(a.waktu);
  });
  
  const filteredTxs = sortedTxs.filter(tx => {
    const itemsStr = Array.isArray(tx.items) 
      ? tx.items.map(item => item.nama).join(" ").toLowerCase()
      : (tx.daftar_item || tx.items || "").toLowerCase();
      
    const waktuStr = new Date(tx.waktu).toLocaleString('id-ID').toLowerCase();
    
    const matchesSearch = tx.id.toLowerCase().includes(searchVal) || 
                          waktuStr.includes(searchVal) ||
                          itemsStr.includes(searchVal) ||
                          tx.total.toString().includes(searchVal);
                          
    if (!matchesSearch) return false;
    
    if (tx.waktu) {
      const txDate = new Date(tx.waktu);
      if (startLimit && txDate < startLimit) return false;
      if (endLimit && txDate > endLimit) return false;
    }
    return true;
  });
  
  if (filteredTxs.length === 0) {
    alert("Daftar transaksi yang disaring kosong!");
    return;
  }
  
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "ID Transaksi,Waktu,Daftar Item,Total Tagihan,Uang Bayar,Kembalian\n";
  
  filteredTxs.forEach(tx => {
    let itemsDisplay = "";
    if (Array.isArray(tx.items)) {
      itemsDisplay = tx.items.map(item => `${item.nama} (${item.qty}x @${item.harga})`).join(" | ");
    } else {
      itemsDisplay = tx.daftar_item || tx.items || "";
    }
    
    const row = [
      `"${tx.id}"`,
      `"${new Date(tx.waktu).toLocaleString('id-ID')}"`,
      `"${itemsDisplay.replace(/"/g, '""')}"`,
      tx.total,
      tx.bayar,
      tx.kembalian
    ].join(",");
    csvContent += row + "\n";
  });
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Laporan_Penjualan_KasirKilat_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  
  link.click();
  document.body.removeChild(link);
}

function printDailyReport() {
  document.getElementById('print-rep-store-name').textContent = receiptSettings.name;
  document.getElementById('print-rep-store-address').textContent = receiptSettings.address;
  
  const now = new Date();
  document.getElementById('print-rep-date').textContent = "Tanggal: " + now.toLocaleDateString('id-ID');
  document.getElementById('print-rep-timestamp').textContent = "Waktu Cetak: " + now.toLocaleString('id-ID');
  
  document.getElementById('print-rep-revenue').textContent = document.getElementById('stat-revenue').textContent;
  document.getElementById('print-rep-net-profit').textContent = document.getElementById('stat-net-profit').textContent;
  
  const printBestsellers = document.getElementById('print-rep-best-sellers');
  printBestsellers.innerHTML = '';
  const uiBestsellers = document.querySelectorAll('#best-sellers-body tr');
  uiBestsellers.forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length >= 4) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="padding: 0.25rem 0; text-align: left;">${tds[1].textContent}</td>
        <td style="text-align: center;">${tds[2].textContent}</td>
        <td style="text-align: right;">${tds[3].textContent}</td>
      `;
      printBestsellers.appendChild(row);
    }
  });
  if (printBestsellers.innerHTML === '') {
    printBestsellers.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 0.5rem 0;">Belum ada penjualan.</td></tr>';
  }
  
  const printLowstocks = document.getElementById('print-rep-low-stocks');
  printLowstocks.innerHTML = '';
  const uiLowstocks = document.querySelectorAll('#stock-alerts-list li');
  uiLowstocks.forEach(li => {
    const nameEl = li.querySelector('.alert-item-name');
    const badgeEl = li.querySelector('.alert-item-badge');
    if (nameEl && badgeEl) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="padding: 0.25rem 0; text-align: left;">${nameEl.textContent}</td>
        <td style="text-align: right; font-weight: bold;">${badgeEl.textContent}</td>
      `;
      printLowstocks.appendChild(row);
    }
  });
  if (printLowstocks.innerHTML === '') {
    printLowstocks.innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 0.5rem 0;">Stok aman terkendali.</td></tr>';
  }
  
  document.body.classList.add('printing-daily-report');
  window.print();
}

// --- MODUL CETAK LABEL HARGA & BARCODE (FITUR BARU) ---
function openPrintLabelModal(productId, defaultType = 'product') {
  const p = products.find(prod => prod.id === productId);
  if (!p) {
    alert("Produk tidak ditemukan!");
    return;
  }
  
  document.getElementById('print-label-prod-id').value = productId;
  document.getElementById('print-label-type').value = defaultType;
  document.getElementById('print-label-qty').value = 1;
  
  updateLabelPreview();
  document.getElementById('print-label-modal').classList.add('active');
}

function closePrintLabelModal() {
  document.getElementById('print-label-modal').classList.remove('active');
}

function updateLabelPreview() {
  const productId = document.getElementById('print-label-prod-id').value;
  const p = products.find(prod => prod.id === productId);
  if (!p) return;
  
  const labelType = document.getElementById('print-label-type').value;
  const previewContainer = document.getElementById('label-preview-container');
  previewContainer.innerHTML = '';
  
  const storeName = receiptSettings.name || 'KasirKilat';
  const priceFormatted = `Rp ${formatRupiah(p.harga_jual)}`;
  
  if (labelType === 'product') {
    // Render label produk (ada barcode)
    const barcodeVal = p.id;
    const barcodeSVG = generateCode39SVG(barcodeVal);
    
    const labelDiv = document.createElement('div');
    labelDiv.className = 'label-item-print product-label';
    labelDiv.innerHTML = `
      <div class="label-store">${storeName}</div>
      <div class="label-name">${p.nama}</div>
      <div class="label-price">${priceFormatted}</div>
      <div class="label-barcode-svg">${barcodeSVG}</div>
      <div class="label-barcode-text">${barcodeVal}</div>
    `;
    previewContainer.appendChild(labelDiv);
  } else {
    // Render label rak (nama & harga besar)
    const labelDiv = document.createElement('div');
    labelDiv.className = 'label-item-print shelf-label';
    labelDiv.innerHTML = `
      <div class="label-store">${storeName}</div>
      <div class="label-name">${p.nama}</div>
      <div class="label-price-box">
        <span class="label-price-label">Harga</span>
        <span class="label-price">${priceFormatted}</span>
      </div>
    `;
    previewContainer.appendChild(labelDiv);
  }
}

function printLabels() {
  const productId = document.getElementById('print-label-prod-id').value;
  const p = products.find(prod => prod.id === productId);
  if (!p) return;
  
  const labelType = document.getElementById('print-label-type').value;
  const qty = parseInt(document.getElementById('print-label-qty').value) || 1;
  const printArea = document.getElementById('labels-print-area');
  printArea.innerHTML = '';
  
  const storeName = receiptSettings.name || 'KasirKilat';
  const priceFormatted = `Rp ${formatRupiah(p.harga_jual)}`;
  
  const container = document.createElement('div');
  container.className = 'labels-print-container';
  
  for (let i = 0; i < qty; i++) {
    const labelDiv = document.createElement('div');
    if (labelType === 'product') {
      const barcodeVal = p.id;
      const barcodeSVG = generateCode39SVG(barcodeVal);
      labelDiv.className = 'label-item-print product-label';
      labelDiv.innerHTML = `
        <div class="label-store">${storeName}</div>
        <div class="label-name">${p.nama}</div>
        <div class="label-price">${priceFormatted}</div>
        <div class="label-barcode-svg">${barcodeSVG}</div>
        <div class="label-barcode-text">${barcodeVal}</div>
      `;
    } else {
      labelDiv.className = 'label-item-print shelf-label';
      labelDiv.innerHTML = `
        <div class="label-store">${storeName}</div>
        <div class="label-name">${p.nama}</div>
        <div class="label-price-box">
          <span class="label-price-label">Harga</span>
          <span class="label-price">${priceFormatted}</span>
        </div>
      `;
    }
    container.appendChild(labelDiv);
  }
  
  printArea.appendChild(container);
  closePrintLabelModal();
  
  document.body.classList.add('printing-labels');
  window.print();
}

// Deteksi cetak label selesai
window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing-labels');
});

// --- NOTIFIKASI KENAIKAN HARGA (FITUR BARU) ---
function showPriceChangeNotification(p, oldPrice, newPrice) {
  document.getElementById('price-change-prod-name').textContent = p.nama;
  document.getElementById('price-change-old').textContent = `Rp ${formatRupiah(oldPrice)}`;
  document.getElementById('price-change-new').textContent = `Rp ${formatRupiah(newPrice)}`;
  
  const btnPrint = document.getElementById('btn-print-change-label');
  btnPrint.onclick = () => {
    closePriceChangeModal();
    openPrintLabelModal(p.id, 'shelf');
  };
  
  document.getElementById('price-change-modal').classList.add('active');
}

function closePriceChangeModal() {
  document.getElementById('price-change-modal').classList.remove('active');
}

// --- FITUR CETAK LABEL MASSAL (BULK PRINTING - FITUR BARU) ---
function toggleProductSelection(productId, checkbox) {
  if (checkbox.checked) {
    selectedProductIds.add(productId);
  } else {
    selectedProductIds.delete(productId);
  }
  updateBulkActionButtonState();
}

function toggleSelectAllProducts(masterCheckbox) {
  const searchVal = document.getElementById('product-list-search').value.toLowerCase().trim();
  const matched = products.filter(p => {
    return p.nama.toLowerCase().includes(searchVal) || 
           p.id.toLowerCase().includes(searchVal) ||
           (p.barcode && p.barcode.toLowerCase().includes(searchVal)) ||
           (p.kategori && p.kategori.toLowerCase().includes(searchVal));
  });
  const itemsToRender = searchVal === '' ? matched.slice(0, 10) : matched;

  itemsToRender.forEach(p => {
    if (masterCheckbox.checked) {
      selectedProductIds.add(p.id);
    } else {
      selectedProductIds.delete(p.id);
    }
  });

  const checkboxes = document.querySelectorAll('.product-select-checkbox');
  checkboxes.forEach(cb => {
    const id = cb.getAttribute('data-id');
    cb.checked = selectedProductIds.has(id);
  });

  updateBulkActionButtonState();
}

function updateBulkActionButtonState() {
  const count = selectedProductIds.size;
  const btnBulk = document.getElementById('btn-bulk-print-labels');
  const countEl = document.getElementById('bulk-select-count');
  
  if (btnBulk && countEl) {
    if (count > 0) {
      countEl.textContent = count;
      btnBulk.style.display = 'inline-flex';
    } else {
      btnBulk.style.display = 'none';
    }
  }
  
  const masterCb = document.getElementById('select-all-products');
  if (masterCb) {
    const checkboxes = document.querySelectorAll('.product-select-checkbox');
    if (checkboxes.length > 0) {
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      masterCb.checked = allChecked;
    } else {
      masterCb.checked = false;
    }
  }
}

function openBulkPrintLabelModal() {
  if (selectedProductIds.size === 0) {
    alert("Pilih minimal satu produk!");
    return;
  }
  
  const listContainer = document.getElementById('bulk-print-products-list');
  listContainer.innerHTML = '';
  
  selectedProductIds.forEach(id => {
    const p = products.find(prod => prod.id === id);
    if (p) {
      const row = document.createElement('div');
      row.className = 'bulk-print-row';
      row.style.display = 'flex';
      row.style.justify = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '0.5rem 0';
      row.style.borderBottom = '1px solid var(--border-color)';
      row.innerHTML = `
        <span style="font-weight: 600; font-size: 0.85rem; color: var(--text-main);">${p.nama} (${p.id})</span>
        <input type="number" class="bulk-print-qty-input" data-id="${p.id}" min="1" max="100" value="1" style="width: 70px; padding: 0.35rem 0.5rem; border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); text-align: center; font-weight: bold; outline: none; font-family: var(--font-main);">
      `;
      listContainer.appendChild(row);
    }
  });
  
  document.getElementById('bulk-print-label-type').value = 'product';
  document.getElementById('bulk-print-label-modal').classList.add('active');
}

function closeBulkPrintLabelModal() {
  document.getElementById('bulk-print-label-modal').classList.remove('active');
}

function printBulkLabels() {
  const labelType = document.getElementById('bulk-print-label-type').value;
  const printArea = document.getElementById('labels-print-area');
  printArea.innerHTML = '';
  
  const qtyInputs = document.querySelectorAll('.bulk-print-qty-input');
  const storeName = receiptSettings.name || 'KasirKilat';
  
  const container = document.createElement('div');
  container.className = 'labels-print-container';
  
  let totalPrinted = 0;
  
  qtyInputs.forEach(input => {
    const productId = input.getAttribute('data-id');
    const qty = parseInt(input.value) || 0;
    const p = products.find(prod => prod.id === productId);
    
    if (p && qty > 0) {
      totalPrinted += qty;
      const priceFormatted = `Rp ${formatRupiah(p.harga_jual)}`;
      
      for (let i = 0; i < qty; i++) {
        const labelDiv = document.createElement('div');
        if (labelType === 'product') {
          const barcodeVal = p.id;
          const barcodeSVG = generateCode39SVG(barcodeVal);
          labelDiv.className = 'label-item-print product-label';
          labelDiv.innerHTML = `
            <div class="label-store">${storeName}</div>
            <div class="label-name">${p.nama}</div>
            <div class="label-price">${priceFormatted}</div>
            <div class="label-barcode-svg">${barcodeSVG}</div>
            <div class="label-barcode-text">${barcodeVal}</div>
          `;
        } else {
          labelDiv.className = 'label-item-print shelf-label';
          labelDiv.innerHTML = `
            <div class="label-store">${storeName}</div>
            <div class="label-name">${p.nama}</div>
            <div class="label-price-box">
              <span class="label-price-label">Harga</span>
              <span class="label-price">${priceFormatted}</span>
            </div>
          `;
        }
        container.appendChild(labelDiv);
      }
    }
  });
  
  if (totalPrinted === 0) {
    alert("Tidak ada label yang dicetak!");
    return;
  }
  
  printArea.appendChild(container);
  closeBulkPrintLabelModal();
  
  document.body.classList.add('printing-labels');
  window.print();
  
  // Bersihkan pilihan setelah print sukses dipicu
  selectedProductIds.clear();
  renderProductsTable();
}

// --- LOGIKA PELUNASAN PIUTANG / BON (FITUR BARU) ---
function openSettleDebtModal(txId) {
  const tx = transactions.find(t => t.id === txId);
  if (!tx) {
    alert("Transaksi tidak ditemukan!");
    return;
  }
  
  document.getElementById('settle-debt-tx-id').value = txId;
  document.getElementById('settle-debt-customer-name').textContent = tx.nama_pelanggan || 'Pelanggan Tanpa Nama';
  document.getElementById('settle-debt-remaining-amount').textContent = `Rp ${formatRupiah(tx.sisa_piutang)}`;
  
  const amountInput = document.getElementById('settle-debt-amount');
  amountInput.value = '';
  document.getElementById('btn-submit-settle-debt').disabled = true;
  
  document.getElementById('settle-debt-modal').classList.add('active');
  setTimeout(() => {
    amountInput.focus();
  }, 100);
}

function closeSettleDebtModal() {
  document.getElementById('settle-debt-modal').classList.remove('active');
}

function formatSettleDebtAmount(input) {
  const cleanVal = input.value.replace(/\D/g, "");
  if (cleanVal === "") {
    input.value = "";
  } else {
    input.value = new Intl.NumberFormat('id-ID').format(cleanVal);
  }
  
  const amount = parseFloat(cleanVal) || 0;
  const btnSubmit = document.getElementById('btn-submit-settle-debt');
  if (amount > 0) {
    btnSubmit.disabled = false;
  } else {
    btnSubmit.disabled = true;
  }
}

function submitSettleDebt() {
  const txId = document.getElementById('settle-debt-tx-id').value;
  const tx = transactions.find(t => t.id === txId);
  if (!tx) {
    alert("Transaksi tidak ditemukan!");
    return;
  }
  
  const amountInput = document.getElementById('settle-debt-amount');
  const cleanVal = amountInput.value.replace(/\./g, "");
  const payAmount = parseFloat(cleanVal) || 0;
  
  if (payAmount <= 0) {
    alert("Masukkan nominal pembayaran yang valid!");
    return;
  }
  
  const originalSisa = tx.sisa_piutang || 0;
  const originalBayar = tx.bayar || 0;
  
  if (payAmount >= originalSisa) {
    // Lunas
    tx.sisa_piutang = 0;
    tx.status_pembayaran = 'Lunas';
    tx.kembalian = payAmount - originalSisa;
    tx.bayar = originalBayar + originalSisa;
    alert(`Pelunasan berhasil! Bon lunas. Kembalian: Rp ${formatRupiah(tx.kembalian)}`);
  } else {
    // Cicil / bayar sebagian
    tx.sisa_piutang = originalSisa - payAmount;
    tx.status_pembayaran = 'Bon';
    tx.kembalian = 0;
    tx.bayar = originalBayar + payAmount;
    alert(`Pembayaran cicilan berhasil! Sisa piutang sekarang: Rp ${formatRupiah(tx.sisa_piutang)}`);
  }
  
  // Simpan ke LocalStorage
  localStorage.setItem('kasir_transactions', JSON.stringify(transactions));
  
  // Update UI
  closeSettleDebtModal();
  renderTransactionsTable();
  updateAnalytics();
  
  // Sinkronkan ke cloud
  syncTransactionsToCloudBackground();
}

// --- MODUL SHIFT KASIR ---

function updateShiftStatusUI() {
  const btnText = document.getElementById('shift-status-text');
  const btnStatus = document.getElementById('btn-shift-status');
  if (!btnText || !btnStatus) return;
  
  if (activeShift) {
    btnText.textContent = `Shift: Aktif (${activeShift.nama_kasir})`;
    btnStatus.style.borderColor = 'var(--primary-color)';
    btnStatus.style.color = 'var(--primary-color)';
    btnStatus.style.background = 'rgba(37, 99, 235, 0.08)';
    btnStatus.style.boxShadow = '0 0 10px rgba(37, 99, 235, 0.2)';
  } else {
    btnText.textContent = 'Buka Shift Kasir';
    btnStatus.style.borderColor = 'var(--border-color)';
    btnStatus.style.color = 'var(--text-main)';
    btnStatus.style.background = 'var(--bg-surface-elevated)';
    btnStatus.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
  }
}

function openShiftModal() {
  const modal = document.getElementById('shift-modal');
  const body = document.getElementById('shift-modal-body');
  const title = document.getElementById('shift-modal-title');
  
  if (!activeShift) {
    title.textContent = 'Buka Shift Kasir';
    let cashierOptions = cashiers.map(c => `<option value="${c}">${c}</option>`).join('');
    
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div class="form-group">
          <label style="font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem; display: block;">Pilih Kasir</label>
          <select id="shift-kasir" class="form-control" style="width: 100%; padding: 0.75rem; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background: var(--bg-surface-elevated); font-size: 1rem;">${cashierOptions}</select>
        </div>
        <div class="form-group">
          <label style="font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem; display: block;">Jenis Shift</label>
          <select id="shift-jenis" class="form-control" style="width: 100%; padding: 0.75rem; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background: var(--bg-surface-elevated); font-size: 1rem;">
            <option value="Shift 1 (07:00 - 15:00)">Shift 1 (07:00 - 15:00)</option>
            <option value="Shift 2 (15:00 - 21:00)">Shift 2 (15:00 - 21:00)</option>
            <option value="Shift Custom">Shift Custom</option>
          </select>
        </div>
        <div class="form-group">
          <label style="font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem; display: block;">Modal Awal / Uang Laci (Rp)</label>
          <div style="position: relative;">
            <span style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-weight: 600;">Rp</span>
            <input type="text" id="shift-modal-awal" class="form-control" placeholder="100.000" onkeyup="formatRupiahInput(this)" style="width: 100%; padding: 0.75rem 1rem 0.75rem 2.5rem; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); font-size: 1.1rem; font-weight: 600;">
          </div>
        </div>
        <button class="btn btn-primary" style="width: 100%; padding: 0.85rem; font-size: 1.1rem; font-weight: 600; margin-top: 0.5rem; box-shadow: var(--shadow-md);" onclick="submitOpenShift()">🚀 Buka Shift Sekarang</button>
      </div>
    `;
  } else {
    title.textContent = 'Tutup Shift Kasir';
    
    // Hitung estimasi uang di laci
    const startTime = new Date(activeShift.waktu_buka).getTime();
    let totalUangMasuk = 0;
    
    transactions.forEach(tx => {
      const txTime = new Date(tx.waktu).getTime();
      // Hanya hitung transaksi tunai yang terjadi selama shift ini
      if (txTime >= startTime && tx.metode_pembayaran === 'Tunai') {
        const cashMasuk = tx.bayar - tx.kembalian;
        if (cashMasuk > 0) totalUangMasuk += cashMasuk;
      }
    });
    
    const estimasiLaci = activeShift.modal_awal + totalUangMasuk;
    
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%); padding: 1.5rem; border-radius: var(--border-radius-md); text-align: center; border: 1px solid rgba(59, 130, 246, 0.2);">
          <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Estimasi Uang Laci Seharusnya</p>
          <h3 style="color: var(--primary-color); font-size: 2rem; margin: 0; font-weight: 800; text-shadow: 0 2px 4px rgba(0,0,0,0.05);">Rp ${formatRupiah(estimasiLaci)}</h3>
          <div style="display: flex; justify-content: center; gap: 1rem; margin-top: 0.75rem; font-size: 0.8rem; color: var(--text-muted);">
            <span>Modal: <strong>Rp ${formatRupiah(activeShift.modal_awal)}</strong></span>
            <span>+</span>
            <span>Masuk: <strong>Rp ${formatRupiah(totalUangMasuk)}</strong></span>
          </div>
        </div>
        
        <div class="form-group">
          <label style="font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem; display: block;">Hitungan Fisik Uang Laci (Rp)*</label>
          <div style="position: relative;">
            <span style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-weight: 600;">Rp</span>
            <input type="text" id="shift-uang-fisik" class="form-control" placeholder="0" onkeyup="formatRupiahInput(this)" style="width: 100%; padding: 1rem 1rem 1rem 2.5rem; border-radius: var(--border-radius-md); border: 2px solid var(--border-color); font-size: 1.5rem; font-weight: 700; color: var(--text-main); background: var(--bg-card); transition: all 0.2s ease;">
          </div>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">Hitung seluruh uang tunai yang ada di laci saat ini.</p>
        </div>
        <button class="btn btn-primary" style="width: 100%; padding: 1rem; font-size: 1.1rem; font-weight: 700; border-radius: var(--border-radius-md); box-shadow: var(--shadow-md); background: linear-gradient(to right, var(--primary-color), var(--primary-hover)); margin-top: 0.5rem;" onclick="submitCloseShift(${totalUangMasuk}, ${estimasiLaci})">🔒 Akhiri Shift & Simpan Laporan</button>
      </div>
    `;
  }
  
  modal.classList.add('active');
}

function closeShiftModal() {
  document.getElementById('shift-modal').classList.remove('active');
}

function submitOpenShift() {
  const kasir = document.getElementById('shift-kasir').value;
  const jenis = document.getElementById('shift-jenis').value;
  const modalAwalInput = document.getElementById('shift-modal-awal').value.replace(/\./g, "");
  const modalAwal = parseFloat(modalAwalInput) || 0;
  
  activeShift = {
    id_shift: 'SH-' + Date.now().toString().slice(-8),
    nama_kasir: kasir,
    jenis_shift: jenis,
    waktu_buka: new Date().toISOString(),
    modal_awal: modalAwal,
    status: 'aktif'
  };
  
  localStorage.setItem('kasir_active_shift', JSON.stringify(activeShift));
  
  // Set active cashier in memory as well
  activeCashier = kasir;
  localStorage.setItem('kasir_active_cashier', activeCashier);
  
  updateShiftStatusUI();
  closeShiftModal();
  alert(`Shift ${jenis} berhasil dibuka oleh ${kasir}.`);
}

function submitCloseShift(totalUangMasuk, estimasiLaci) {
  const fisikInput = document.getElementById('shift-uang-fisik').value.replace(/\./g, "");
  if (!fisikInput) {
    alert("Harap masukkan hitungan fisik uang laci!");
    return;
  }
  
  const uangFisik = parseFloat(fisikInput) || 0;
  const selisih = uangFisik - estimasiLaci;
  
  const closedShift = {
    ...activeShift,
    waktu_tutup: new Date().toISOString(),
    total_uang_masuk: totalUangMasuk,
    uang_fisik: uangFisik,
    selisih: selisih,
    status: 'ditutup'
  };
  
  shifts.push(closedShift);
  localStorage.setItem('kasir_shifts', JSON.stringify(shifts));
  
  activeShift = null;
  localStorage.removeItem('kasir_active_shift');
  
  updateShiftStatusUI();
  closeShiftModal();
  
  let msg = `Shift berhasil ditutup.\nSelisih uang: Rp ${formatRupiah(selisih)}\n`;
  if (selisih < 0) msg += "(Minus / Uang Kurang)";
  else if (selisih > 0) msg += "(Lebih)";
  else msg += "(Uang Pas)";
  
  alert(msg);
}

function formatRupiahInput(input) {
  const cleanVal = input.value.replace(/\D/g, "");
  if (cleanVal === "") {
    input.value = "";
  } else {
    input.value = new Intl.NumberFormat('id-ID').format(cleanVal);
  }
}

// --- MODUL PELANGGAN & CRM ---

function renderCustomersTable() {
  const tbody = document.getElementById('customer-table-body');
  if (!tbody) return;
  const search = document.getElementById('customer-search')?.value.toLowerCase() || '';
  
  tbody.innerHTML = '';
  
  const filtered = customers.filter(c => 
    c.nama.toLowerCase().includes(search) || 
    (c.telepon && c.telepon.toLowerCase().includes(search))
  );
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Tidak ada pelanggan.</td></tr>';
    return;
  }
  
  filtered.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${c.nama}</strong></td>
      <td>${c.telepon || '-'}</td>
      <td><span style="background: var(--bg-body); padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 600; color: var(--primary-color);">${c.poin || 0}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" style="padding: 0.25rem 0.5rem;" onclick="editCustomer('${c.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" style="padding: 0.25rem 0.5rem;" onclick="deleteCustomer('${c.id}')">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function saveCustomer(event) {
  event.preventDefault();
  
  const id = document.getElementById('edit-customer-id').value;
  const nama = document.getElementById('cust-name').value.trim();
  const telepon = document.getElementById('cust-phone').value.trim();
  const poin = parseInt(document.getElementById('cust-points').value) || 0;
  
  if (!nama) {
    alert("Nama pelanggan wajib diisi!");
    return;
  }
  
  if (id) {
    const index = customers.findIndex(c => c.id === id);
    if (index !== -1) {
      customers[index] = { ...customers[index], nama, telepon, poin };
    }
  } else {
    customers.push({
      id: 'CUST-' + Date.now(),
      nama,
      telepon,
      poin
    });
  }
  
  saveCustomersLocally();
  renderCustomersTable();
  resetCustomerForm();
}

function editCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  
  document.getElementById('edit-customer-id').value = c.id;
  document.getElementById('cust-name').value = c.nama;
  document.getElementById('cust-phone').value = c.telepon || '';
  document.getElementById('cust-points').value = c.poin || 0;
  
  document.getElementById('customer-form-title').textContent = 'Edit Pelanggan';
}

function deleteCustomer(id) {
  if (confirm("Hapus pelanggan ini?")) {
    customers = customers.filter(c => c.id !== id);
    saveCustomersLocally();
    renderCustomersTable();
  }
}

function resetCustomerForm() {
  document.getElementById('customer-form').reset();
  document.getElementById('edit-customer-id').value = '';
  document.getElementById('customer-form-title').textContent = 'Tambah Pelanggan Baru';
}

function saveCustomersLocally() {
  localStorage.setItem('kasir_customers', JSON.stringify(customers));
}

function onCustomerSelectChange() {
  const name = document.getElementById('customer-name-input').value.trim();
  const customer = customers.find(c => c.nama === name);
  const infoDiv = document.getElementById('customer-points-info');
  
  if (customer) {
    infoDiv.style.display = 'block';
    document.getElementById('customer-points-balance').textContent = customer.poin || 0;
    document.getElementById('customer-points-rp').textContent = `Rp ${formatRupiah((customer.poin || 0) * loyaltySettings.rpPerPoint)}`;
  } else {
    infoDiv.style.display = 'none';
    document.getElementById('redeem-points-input').value = '';
  }
  calculateChange();
}

function saveLoyaltySettings() {
  const ptsPerRp = parseInt(document.getElementById('setting-points-per-rp').value) || 50000;
  const rpPerPt = parseInt(document.getElementById('setting-rp-per-point').value) || 1000;
  
  loyaltySettings = { pointsPerRp: ptsPerRp, rpPerPoint: rpPerPt };
  localStorage.setItem('kasir_loyalty_settings', JSON.stringify(loyaltySettings));
  alert('Pengaturan Poin Pelanggan berhasil disimpan!');
}

// --- MANAJEMEN ANTREAN / JEDA KERANJANG ---
function saveHeldCarts() {
  localStorage.setItem('kasir_held_carts', JSON.stringify(heldCarts));
}

function holdCurrentCart() {
  if (cart.length === 0) {
    alert('Keranjang saat ini kosong, tidak ada yang perlu dijeda.');
    return;
  }
  
  const customerName = prompt('Masukkan nama pelanggan atau catatan untuk antrean ini (Opsional):', `Antrean ${heldCarts.length + 1}`);
  if (customerName === null) return; // Batal
  
  const heldItem = {
    id: 'HOLD-' + Date.now().toString().slice(-6),
    name: customerName || `Antrean ${heldCarts.length + 1}`,
    time: new Date().toISOString(),
    items: [...cart]
  };
  
  heldCarts.push(heldItem);
  saveHeldCarts();
  
  cart = [];
  renderCart();
  updateHeldCartsUI();
  alert('Keranjang berhasil dijeda dan masuk ke daftar antrean.');
}

function updateHeldCartsUI() {
  const badge = document.getElementById('held-carts-badge');
  if (badge) {
    badge.textContent = heldCarts.length;
    badge.style.display = heldCarts.length > 0 ? 'flex' : 'none';
  }
}

function openHeldCartsModal() {
  const tbody = document.getElementById('held-carts-tbody');
  tbody.innerHTML = '';
  
  if (heldCarts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem;">Tidak ada antrean keranjang.</td></tr>`;
  } else {
    heldCarts.forEach((h, index) => {
      const dateObj = new Date(h.time);
      const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      
      let totalItems = h.items.reduce((sum, i) => sum + i.qty, 0);
      let totalHarga = h.items.reduce((sum, i) => sum + (i.harga * i.qty), 0);
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);"><strong>${h.name}</strong><br><small style="color: var(--text-muted)">${timeStr}</small></td>
        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">${totalItems} item</td>
        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">Rp ${formatRupiah(totalHarga)}</td>
        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: right;">
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button class="btn btn-primary btn-sm" onclick="restoreHeldCart(${index})" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Lanjutkan</button>
            <button class="btn btn-danger btn-sm" onclick="deleteHeldCart(${index})" style="padding: 0.25rem 0.5rem;">
              <svg viewBox="0 0 24 24" class="icon-sm" style="margin:0"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
  
  document.getElementById('held-carts-modal').classList.add('active');
}

function closeHeldCartsModal() {
  document.getElementById('held-carts-modal').classList.remove('active');
}

function restoreHeldCart(index) {
  if (cart.length > 0) {
    if (!confirm('Keranjang saat ini tidak kosong. Menarik antrean akan MENGGANTI keranjang saat ini. Lanjutkan?')) {
      return;
    }
  }
  
  const h = heldCarts[index];
  cart = [...h.items];
  heldCarts.splice(index, 1);
  saveHeldCarts();
  
  renderCart();
  updateHeldCartsUI();
  closeHeldCartsModal();
}

function deleteHeldCart(index) {
  if (confirm('Yakin ingin menghapus antrean keranjang ini permanen?')) {
    heldCarts.splice(index, 1);
    saveHeldCarts();
    openHeldCartsModal();
    updateHeldCartsUI();
  }
}

// Inisialisasi awal UI antrean saat memuat
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    updateHeldCartsUI();
  }, 500);
});
