/**
 * GOOGLE APPS SCRIPT BACKEND FOR KASIR ONLINE (PEMBARUAN FITUR LENGKAP)
 * 
 * Petunjuk Pemasangan:
 * 1. Buka Google Sheets Anda.
 * 2. Klik menu "Extensions" (Ekstensi) -> "Apps Script".
 * 3. Ganti semua kode lama dengan kode baru ini.
 * 4. Klik ikon Save (Simpan).
 * 5. Klik "Deploy" -> "Manage deployments" -> Edit deployment -> Deploy (atau buat New deployment baru)
 * 6. Setel tipe: "Web app" (Aplikasi web) dengan akses "Anyone" (Siapa saja).
 * 7. Salin URL Web App yang baru ke Pengaturan Aplikasi Kasir.
 */

function doGet(e) {
  setupSheets();
  var action = e.parameter.action;
  
  if (action === "getProducts") {
    return handleResponse(getProductsData());
  }
  if (action === "getTransactions") {
    return handleResponse(getTransactionsData());
  }
  
  return handleResponse({ status: "error", message: "Aksi GET tidak dikenali" });
}

function doPost(e) {
  setupSheets();
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    
    if (action === "addTransaction") {
      return handleResponse(saveTransaction(data.transaction));
    }
    if (action === "updateProducts") {
      return handleResponse(updateProducts(data.products));
    }
    if (action === "updateTransactions") {
      return handleResponse(updateTransactions(data.transactions));
    }
    if (action === "upsertProduct") {
      return handleResponse(upsertProduct(data.product));
    }
    if (action === "deleteProduct") {
      return handleResponse(deleteProduct(data.productId));
    }
    
    return handleResponse({ status: "error", message: "Aksi POST tidak dikenali" });
  } catch (error) {
    return handleResponse({ status: "error", message: "Terjadi kesalahan: " + error.toString() });
  }
}

function handleResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Inisialisasi & Perbaikan Sheet jika belum lengkap (Schema Lengkap)
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var headers = ["ID", "Nama", "Kategori", "Harga Beli", "Harga Jual", "Stok", "Barcode", "Gambar", "Tanggal Kadaluarsa", "Harga Diskon", "Kuota Diskon", "Has Unit Box", "Barcode Box", "Nama Box", "Isi Box", "Harga Box", "Grosir Qty", "Grosir Harga", "Promo Beli X", "Promo Gratis Y"];
  
  // 1. Sheet Produk
  var sheetProduk = ss.getSheetByName("Produk");
  if (!sheetProduk) {
    sheetProduk = ss.insertSheet("Produk");
    sheetProduk.appendRow(headers);
    
    // Tambah data contoh
    sheetProduk.appendRow([
      "P001", 
      "Kopi Hitam", 
      "Minuman", 
      3000, 
      5000, 
      50, 
      "8996001300124", 
      "https://m.media-amazon.com/images/I/71Bs3RzmTyL._SL1500_.jpg",
      "2027-12-31",
      0,
      0,
      "FALSE",
      "",
      "",
      0,
      0,
      0,
      0,
      0,
      0
    ]);
  } else {
    // Perbaikan Header jika kolom baru belum ada
    var currentLastCol = Math.max(1, sheetProduk.getLastColumn());
    var existingHeaders = sheetProduk.getRange(1, 1, 1, currentLastCol).getValues()[0];
    
    // Set format teks untuk kolom ID, Barcode, & Barcode Box agar 0 di depan tidak terhapus otomatis oleh Google Sheets
    sheetProduk.getRange("A:A").setNumberFormat("@");
    sheetProduk.getRange("G:G").setNumberFormat("@");
    sheetProduk.getRange("M:M").setNumberFormat("@");
    
    if (existingHeaders.length < headers.length) {
      // Perbarui baris header tanpa menghapus data produk di bawahnya
      sheetProduk.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  
  // 2. Sheet Transaksi
  var sheetTransaksi = ss.getSheetByName("Transaksi");
  var txHeaders = ["ID Transaksi", "Waktu", "Daftar Item", "Total", "Uang Bayar", "Kembalian", "Metode Pembayaran", "Kasir", "Status Pembayaran", "Nama Pelanggan", "Sisa Piutang"];
  if (!sheetTransaksi) {
    sheetTransaksi = ss.insertSheet("Transaksi");
    sheetTransaksi.appendRow(txHeaders);
  } else {
    // Perbaikan Header jika kolom baru belum ada
    var currentLastCol = Math.max(1, sheetTransaksi.getLastColumn());
    var existingHeaders = sheetTransaksi.getRange(1, 1, 1, currentLastCol).getValues()[0];
    if (existingHeaders.length < txHeaders.length) {
      sheetTransaksi.getRange(1, 1, 1, txHeaders.length).setValues([txHeaders]);
    }
  }
}

// Mendapatkan data produk dari Sheet "Produk"
function getProductsData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Produk");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var products = [];
  
  for (var i = 1; i < rows.length; i++) {
    var product = {};
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j].toString().toLowerCase().replace(/ /g, "_");
      var val = rows[i][j];
      if (key === 'has_unit_box') {
        val = val === true || val === "TRUE" || val === "true";
      }
      if (key === 'barcode' || key === 'barcode_box' || key === 'id') {
        val = val !== null && val !== undefined ? val.toString().trim().replace(/^'/, '') : '';
      }
      product[key] = val;
    }
    products.push(product);
  }
  
  return { status: "success", data: products };
}

// Mendapatkan data riwayat transaksi untuk analisis penjualan di web kasir
function getTransactionsData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Transaksi");
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { status: "success", data: [] };
  }
  
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var transactions = [];
  
  for (var i = 1; i < rows.length; i++) {
    var tx = {};
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j].toString().toLowerCase().replace(" ", "_");
      tx[key] = rows[i][j];
    }
    transactions.push(tx);
  }
  
  return { status: "success", data: transactions };
}

// Menyimpan Transaksi dan Mengurangi Stok Produk
function saveTransaction(tx) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetTx = ss.getSheetByName("Transaksi");
  
  // Format items ke string terbaca
  var itemsString = tx.items.map(function(item) {
    var sub = item.subtotal !== undefined ? item.subtotal : (item.harga * item.qty);
    var pInfo = item.promoInfo ? " [" + item.promoInfo + "]" : "";
    var unitP = item.qty > 0 ? Math.round(sub / item.qty) : item.harga;
    return item.nama + pInfo + " (" + item.qty + "x @" + unitP + ")";
  }).join(", ");
  
  sheetTx.appendRow([
    tx.id,
    tx.waktu || new Date().toISOString(),
    itemsString,
    tx.total,
    tx.bayar,
    tx.kembalian,
    tx.metode_pembayaran || "Tunai",
    tx.kasir || "Kasir Utama",
    tx.status_pembayaran || "Lunas",
    tx.nama_pelanggan || "",
    tx.sisa_piutang || 0
  ]);
  
  // Kurangi stok di sheet "Produk" (Kolom ke-6 / Stok / indeks ke-5)
  var sheetProd = ss.getSheetByName("Produk");
  var prodRows = sheetProd.getDataRange().getValues();
  
  for (var i = 0; i < tx.items.length; i++) {
    var soldItem = tx.items[i];
    var soldId = soldItem.id.toString().toLowerCase();
    var soldQty = soldItem.isBox ? (soldItem.qty * (soldItem.isiBox || 12)) : soldItem.qty;
    
    for (var j = 1; j < prodRows.length; j++) {
      var prodId = prodRows[j][0].toString().toLowerCase();
      if (prodId === soldId) {
        var currentStock = Number(prodRows[j][5]); // F: Stok (index 5)
        var newStock = Math.max(0, currentStock - soldQty);
        sheetProd.getRange(j + 1, 6).setValue(newStock); // Update kolom F (6)
        break;
      }
    }
  }
  
  return { status: "success", message: "Transaksi disimpan ke Google Sheets." };
}

// Menambahkan atau memperbarui produk dari dashboard secara massal (Super Cepat!)
function updateProducts(productsList) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Produk");
  
  // Set format teks kolom barcode
  sheet.getRange("A:A").setNumberFormat("@");
  sheet.getRange("G:G").setNumberFormat("@");
  sheet.getRange("M:M").setNumberFormat("@");
  
  // Bersihkan data lama mulai baris kedua ke bawah
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(20, sheet.getLastColumn());
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }
  
  if (productsList.length === 0) {
    return { status: "success", message: "Tabel dikosongkan." };
  }
  
  // Siapkan baris data massal (array 2 dimensi)
  var values = [];
  for (var i = 0; i < productsList.length; i++) {
    var p = productsList[i];
    
    // Pastikan format kadaluarsa dibaca sebagai text/string bersih
    var expDateStr = p.tanggal_kadaluarsa || "";
    if (expDateStr instanceof Date) {
      expDateStr = expDateStr.toISOString().slice(0, 10);
    }
    
    var bcStr = p.barcode ? p.barcode.toString().trim() : "";
    if (bcStr && !bcStr.startsWith("'")) bcStr = "'" + bcStr;
    
    var bcBoxStr = p.barcode_box ? p.barcode_box.toString().trim() : "";
    if (bcBoxStr && !bcBoxStr.startsWith("'")) bcBoxStr = "'" + bcBoxStr;
    
    values.push([
      p.id || "",
      p.nama || "",
      p.kategori || "Umum",
      Number(p.harga_beli) || 0,
      Number(p.harga_jual) || 0,
      Number(p.stok) || 0,
      bcStr,
      p.gambar || "",
      expDateStr,
      Number(p.harga_diskon) || 0,
      Number(p.kuota_diskon) || 0,
      p.has_unit_box ? true : false,
      bcBoxStr,
      p.nama_box || "Kotak",
      Number(p.isi_box) || 0,
      Number(p.harga_box) || 0,
      Number(p.grosir_qty) || 0,
      Number(p.grosir_harga) || 0,
      Number(p.promo_beli_x) || 0,
      Number(p.promo_gratis_y) || 0
    ]);
  }
  
  // Tulis massal dalam satu kali panggil API Google Sheets
  sheet.getRange(2, 1, values.length, 20).setValues(values);
  
  return { status: "success", message: "Sinkronisasi produk (" + productsList.length + " item) sukses secara instan!" };
}

// Menambah atau Memperbarui SATU produk secara spesifik (Incremental Sync)
function upsertProduct(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Produk");
  
  // Set format teks kolom barcode
  sheet.getRange("A:A").setNumberFormat("@");
  sheet.getRange("G:G").setNumberFormat("@");
  sheet.getRange("M:M").setNumberFormat("@");
  
  var rows = sheet.getDataRange().getValues();
  
  var expDateStr = p.tanggal_kadaluarsa || "";
  if (expDateStr instanceof Date) {
    expDateStr = expDateStr.toISOString().slice(0, 10);
  }
  
  var bcStr = p.barcode ? p.barcode.toString().trim() : "";
  if (bcStr && !bcStr.startsWith("'")) bcStr = "'" + bcStr;
  
  var bcBoxStr = p.barcode_box ? p.barcode_box.toString().trim() : "";
  if (bcBoxStr && !bcBoxStr.startsWith("'")) bcBoxStr = "'" + bcBoxStr;
  
  var rowData = [
    p.id || "",
    p.nama || "",
    p.kategori || "Umum",
    Number(p.harga_beli) || 0,
    Number(p.harga_jual) || 0,
    Number(p.stok) || 0,
    bcStr,
    p.gambar || "",
    expDateStr,
    Number(p.harga_diskon) || 0,
    Number(p.kuota_diskon) || 0,
    p.has_unit_box ? true : false,
    bcBoxStr,
    p.nama_box || "Kotak",
    Number(p.isi_box) || 0,
    Number(p.harga_box) || 0,
    Number(p.grosir_qty) || 0,
    Number(p.grosir_harga) || 0,
    Number(p.promo_beli_x) || 0,
    Number(p.promo_gratis_y) || 0
  ];
  
  var found = false;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().trim().toLowerCase() === p.id.toString().trim().toLowerCase()) {
      sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
      found = true;
      break;
    }
  }
  
  if (!found) {
    sheet.appendRow(rowData);
  }
  
  return { status: "success", message: "Produk berhasil diupdate secara individual." };
}

// Menghapus SATU produk secara spesifik
function deleteProduct(productId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Produk");
  var rows = sheet.getDataRange().getValues();
  
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase() === productId.toString().toLowerCase()) {
      sheet.deleteRow(i + 1);
      return { status: "success", message: "Produk berhasil dihapus." };
    }
  }
  return { status: "success", message: "Produk tidak ditemukan." };
}

// Menambahkan atau memperbarui transaksi secara massal (mass-overwrite)
function updateTransactions(transactionsList) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Transaksi");
  
  // Bersihkan data lama mulai baris kedua ke bawah
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 11).clearContent();
  }
  
  if (!transactionsList || transactionsList.length === 0) {
    return { status: "success", message: "Tabel transaksi dikosongkan." };
  }
  
  // Siapkan baris data massal
  var values = [];
  for (var i = 0; i < transactionsList.length; i++) {
    var tx = transactionsList[i];
    
    var itemsString = "";
    if (Array.isArray(tx.items)) {
      itemsString = tx.items.map(function(item) {
        return item.nama + " (" + item.qty + "x @" + item.harga + ")";
      }).join(", ");
    } else if (tx.daftar_item || tx.items) {
      itemsString = tx.daftar_item || tx.items;
    }
    
    values.push([
      tx.id || tx.id_transaksi || "",
      tx.waktu || "",
      itemsString,
      Number(tx.total) || 0,
      Number(tx.bayar) || Number(tx.uang_bayar) || 0,
      Number(tx.kembalian) || 0,
      tx.metode_pembayaran || "Tunai",
      tx.kasir || "Kasir Utama",
      tx.status_pembayaran || "Lunas",
      tx.nama_pelanggan || "",
      Number(tx.sisa_piutang) || 0
    ]);
  }
  
  sheet.getRange(2, 1, values.length, 11).setValues(values);
  return { status: "success", message: "Sinkronisasi transaksi (" + transactionsList.length + " data) sukses secara instan!" };
}
