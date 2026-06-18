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
  var headers = ["ID", "Nama", "Kategori", "Harga Beli", "Harga Jual", "Stok", "Barcode", "Gambar", "Tanggal Kadaluarsa"];
  
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
      "2027-12-31"
    ]);
    sheetProduk.appendRow([
      "P002", 
      "Teh Manis", 
      "Minuman", 
      2000, 
      4000, 
      100, 
      "8996001300247", 
      "https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=300",
      ""
    ]);
  } else {
    // Perbaikan Header jika kolom baru (seperti Tanggal Kadaluarsa / Harga Beli) belum ada
    var currentLastCol = Math.max(1, sheetProduk.getLastColumn());
    var existingHeaders = sheetProduk.getRange(1, 1, 1, currentLastCol).getValues()[0];
    
    if (existingHeaders.length < headers.length || existingHeaders[3] !== "Harga Beli" || existingHeaders[8] !== "Tanggal Kadaluarsa") {
      // Perbarui baris header tanpa menghapus data produk di bawahnya
      sheetProduk.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  
  // 2. Sheet Transaksi
  var sheetTransaksi = ss.getSheetByName("Transaksi");
  if (!sheetTransaksi) {
    sheetTransaksi = ss.insertSheet("Transaksi");
    sheetTransaksi.appendRow(["ID Transaksi", "Waktu", "Daftar Item", "Total", "Uang Bayar", "Kembalian"]);
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
      var key = headers[j].toString().toLowerCase().replace(" ", "_");
      product[key] = rows[i][j];
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
    return item.nama + " (" + item.qty + "x @" + item.harga + ")";
  }).join(", ");
  
  sheetTx.appendRow([
    tx.id,
    tx.waktu || new Date().toISOString(),
    itemsString,
    tx.total,
    tx.bayar,
    tx.kembalian
  ]);
  
  // Kurangi stok di sheet "Produk" (Kolom ke-6 / Stok / indeks ke-5)
  var sheetProd = ss.getSheetByName("Produk");
  var prodRows = sheetProd.getDataRange().getValues();
  
  for (var i = 0; i < tx.items.length; i++) {
    var soldItem = tx.items[i];
    var soldId = soldItem.id.toString().toLowerCase();
    var soldQty = soldItem.qty;
    
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
  
  // Bersihkan data lama mulai baris kedua ke bawah
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 9).clearContent();
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
    
    values.push([
      p.id || "",
      p.nama || "",
      p.kategori || "Umum",
      Number(p.harga_beli) || 0,
      Number(p.harga_jual) || 0,
      Number(p.stok) || 0,
      p.barcode || "",
      p.gambar || "",
      expDateStr
    ]);
  }
  
  // Tulis massal dalam satu kali panggil API Google Sheets
  sheet.getRange(2, 1, values.length, 9).setValues(values);
  
  return { status: "success", message: "Sinkronisasi produk (" + productsList.length + " item) sukses secara instan!" };
}

// Menambahkan atau memperbarui transaksi secara massal (mass-overwrite)
function updateTransactions(transactionsList) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Transaksi");
  
  // Bersihkan data lama mulai baris kedua ke bawah
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 6).clearContent();
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
      Number(tx.kembalian) || 0
    ]);
  }
  
  sheet.getRange(2, 1, values.length, 6).setValues(values);
  return { status: "success", message: "Sinkronisasi transaksi (" + transactionsList.length + " data) sukses secara instan!" };
}
