# Whitelist Domain & Service - BaknusClass

Daftar berikut berisi domain dan endpoint yang wajib diizinkan (whitelist) oleh tim jaringan/IT agar aplikasi dapat berjalan optimal namun tetap menjaga keamanan dari kecurangan internet oleh siswa.

## 1. Domain Aplikasi Utama
*   `baknusclass.smkbn666.sch.id` (Akses Dashboard & CBT)
*   `baknusdrive.smkbn666.sch.id` (Akses File Drive & Media)

## 2. Layanan User Interface (UI)
*   `fonts.googleapis.com`
*   `fonts.gstatic.com`

## 3. Layanan Kecerdasan Buatan (AI Scoring)
*   `generativelanguage.googleapis.com` (Google Gemini API)
*   `api.mistral.ai` (Mistral AI - Cadangan)

## 4. Layanan Otentikasi (Mail Engine)
*   `mail.smk.baktinusantara666.sch.id` (Sinkronisasi akun Mailcow)

---

### Informasi Teknis Jaringan (Untuk Admin Firewall):
1.  **Port Standard:** Pastikan port `80` (HTTP) dan `443` (HTTPS) terbuka untuk semua domain di atas.
2.  **WebSocket:** Izinkan koneksi WebSocket untuk domain `baknusclass.smkbn666.sch.id` (digunakan pada fitur Forum & Real-time Update).
3.  **Local Database Access (Internal):**
    *   IP Host: `192.168.100.2`
    *   Database Oracle Port: `1521`
    *   Cache Redis Port: `6379`
