@echo off
echo ====================================================
echo MENYINKRONKAN KODE KASIR ONLINE KE GITHUB...
echo ====================================================
echo.

:: Cek apakah folder sudah di-inisialisasi git
if not exist .git (
    echo [ERROR] Git belum di-inisialisasi di folder ini.
    echo Silakan jalankan langkah inisialisasi di panduan github_sync_guide.md terlebih dahulu.
    echo.
    pause
    exit /b
)

:: Jalankan proses push
git add .
git commit -m "Update Kasir POS: %date% %time%"
git push origin main

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Gagal mengirim ke GitHub. Periksa koneksi internet atau konfigurasi remote repositori Anda.
) else (
    echo.
    echo ====================================================
    echo SINKRONISASI SELESAI! WEBSITE DI HP AKAN TERUPDATE.
    echo ====================================================
)
echo.
pause
