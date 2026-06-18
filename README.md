# Panduan Penggunaan & Setup: KasirKilat POS

KasirKilat adalah aplikasi kasir (Point of Sale) berbasis web yang **sangat ringan**, **cepat**, dan **dapat berjalan 100% offline**. Aplikasi ini terintegrasi langsung dengan **Google Sheets** sebagai database-nya. 

Dengan sistem ini, Anda dapat memantau penjualan dari mana saja secara real-time. Jika koneksi internet di toko terputus atau listrik mati, kasir dapat langsung membuka aplikasi ini lewat HP (menggunakan paket data) dan melanjutkan pencatatan penjualan tanpa kehilangan data.

---

## Cara Menjalankan Aplikasi
1. Buka folder `kasir-online`.
2. Klik ganda (double-click) pada file **`index.html`** untuk membukanya di browser Anda (Chrome, Edge, Firefox, dll).
3. Aplikasi siap digunakan! Anda tidak perlu memasang server atau software tambahan apapun.

---

## Langkah Menghubungkan ke Google Sheets (Database)

Agar penjualan tercatat ke Google Sheets secara otomatis dan dapat dipantau dari jauh:

### Langkah 1: Siapkan Spreadsheet
1. Buka [Google Sheets](https://sheets.google.com) dan buat dokumen baru kosong.
2. Beri nama spreadsheet Anda (contoh: `Database Kasir Toko`).

### Langkah 2: Memasang Google Apps Script
1. Di dalam Google Sheets Anda, klik menu **Ekstensi** (Extensions) -> **Apps Script**.
2. Hapus semua baris kode bawaan yang ada di editor tersebut.
3. Buka file **`google_apps_script.js`** dari folder aplikasi ini menggunakan aplikasi pembuka teks (seperti Notepad), salin (*copy*) seluruh isinya, lalu tempel (*paste*) ke dalam editor Google Apps Script.
4. Klik tombol **Simpan** (ikon disket di bagian atas).

### Langkah 3: Melakukan Penerapan (Deploy) sebagai Aplikasi Web
1. Klik tombol **Deploy** (Terapkan) di kanan atas -> pilih **New deployment** (Penerapan baru).
2. Klik ikon gir (pilih jenis penerapan) -> pilih **Web app** (Aplikasi web).
3. Konfigurasikan pengaturannya sebagai berikut:
   * **Description**: Kasir API (atau bebas)
   * **Execute as**: **Me (akun email Google Anda)**
   * **Who has access**: **Anyone** (Siapa saja - agar web kasir bisa mengirim data ke sheet ini tanpa ribet)
4. Klik **Deploy**.
5. Jika Google meminta otorisasi, klik **Authorize Access**, pilih akun Google Anda, klik **Advanced** (Lanjutan), lalu klik **Go to Untitled project (unsafe)** atau **Buka projek**, dan berikan izin (*Allow*).
6. Setelah selesai, Anda akan melihat layar bertuliskan "Deployment successfully updated".
7. Salin URL di bagian **Web app URL** (Tautannya akan berakhiran `/exec`).

### Langkah 4: Masukkan URL ke Aplikasi Kasir
1. Buka aplikasi kasir Anda di browser (`index.html`).
2. Masuk ke tab **Pengaturan**.
3. Tempelkan (*paste*) URL Web App yang sudah disalin tadi ke kolom **Google Apps Script Web App URL**.
4. Klik tombol **Simpan URL**.
5. Klik tombol **Uji Koneksi**. Jika muncul notifikasi "Koneksi BERHASIL!", maka aplikasi kasir Anda sudah terhubung sempurna dengan Google Sheets Anda!
6. Google Sheets Anda otomatis akan membuat dua lembar kerja baru: **`Produk`** dan **`Transaksi`** secara otomatis dengan data contoh.

---

## Fitur Unggulan Yang Perlu Dicoba
* **Mode Offline Otomatis:** Matikan koneksi wifi Anda dan lakukan transaksi di kasir. Transaksi akan tetap sukses dan disimpan sementara di browser. Begitu koneksi internet tersambung kembali, sistem akan mengirimkan semua data transaksi yang tertunda tadi ke Google Sheets secara otomatis di latar belakang!
* **Unduh Excel (Offline):** Di tab **Produk & Stok**, Anda bisa menekan tombol "Unduh Excel (CSV)" untuk menyimpan daftar produk Anda secara offline ke file Excel kapan saja.
* **Cetak Struk:** Setelah menyelesaikan transaksi, struk belanja bergaya printer thermal kasir akan muncul. Klik **Cetak Struk** untuk mencetaknya ke printer fisik atau menyimpannya sebagai file PDF.
