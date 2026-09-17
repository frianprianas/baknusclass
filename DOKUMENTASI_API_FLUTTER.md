# Panduan Integrasi REST API BaknusClass untuk Aplikasi Flutter (Pihak ke-3)

Dokumentasi ini disusun khusus bagi developer pihak ke-3 untuk mengintegrasikan aplikasi mobile Flutter dengan sistem ujian CBT BaknusClass.

---

## 1. Informasi Dasar (Base Configuration)

* **Base URL Produksi**: `https://baknusclass.smkbn666.sch.id`
* **Content-Type**: `application/json`
* **Format Header Autentikasi**:
  ```http
  Authorization: Bearer <TOKEN_JWT_DARI_LOGIN>
  ```

---

## 2. Autentikasi (Login Menggunakan Kredensial Mailcow)

Aplikasi Flutter **tidak perlu** mengakses IMAP Mailcow secara langsung. Cukup kirimkan username/email dan password Mailcow pengguna ke REST API BaknusClass. Server kami yang akan memvalidasi ke server Mailcow sekolah dan menerbitkan JWT token.

* **Endpoint**: `POST /api/auth/login`
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "username": "nama_pengguna@smk.baktinusantara666.sch.id",
    "password": "password_mailcow_user"
  }
  ```
  > *Catatan: Field `username` dapat diisi email lengkap atau username saja.*

* **Response (HTTP 200 OK)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "type": "Bearer",
    "username": "frian_p",
    "name": "Frian Prianas",
    "role": "GURU",
    "profileId": 12,
    "kelasId": null
  }
  ```

### Keterangan Field Respon Login:
* `token`: Simpan di Secure Storage Flutter (misal: `flutter_secure_storage`). Kirimkan di header `Authorization: Bearer <token>` pada setiap request berikutnya.
* `role`: Bernilai `"GURU"` atau `"SISWA"`. Gunakan nilai ini untuk mengarahkan rute halaman Flutter.
* `profileId`:
  - Jika `role == "GURU"`: Merupakan `guruId`.
  - Jika `role == "SISWA"`: Merupakan `siswaId`.
* `kelasId`: ID kelas siswa (hanya bernilai untuk siswa).

---

## 3. Alur & Endpoint untuk Akun SISWA

Siswa akan melihat event yang sedang aktif, lalu saat event diklik, hanya mata pelajaran yang ditugaskan ke kelasnya yang akan muncul.

### A. Mengambil Event Ujian Aktif
* **Endpoint**: `GET /api/exam/event/active`
* **Headers**: `Authorization: Bearer <TOKEN_SISWA>`
* **Response (HTTP 200 OK)**:
  ```json
  {
    "id": 1,
    "namaEvent": "Penilaian Akhir Semester (PAS) Ganjil 2026/2027",
    "kodeEvent": "PAS_GANJIL_2026",
    "tanggalMulai": "2026-09-15",
    "tanggalSelesai": "2026-09-25",
    "statusAktif": true
  }
  ```

---

### B. Mengambil Daftar Ujian Sesuai Kelas & Mapel Siswa
Backend secara otomatis menyaring ujian berdasarkan kelas siswa dari Token JWT. Siswa tidak akan melihat ujian milik kelas lain.

* **Endpoint**: `GET /api/exam/ujian-mapel/siswa?eventId={eventId}`
* **Headers**: `Authorization: Bearer <TOKEN_SISWA>`
* **Contoh Request**: `GET /api/exam/ujian-mapel/siswa?eventId=1`
* **Response (HTTP 200 OK)**:
  ```json
  [
    {
      "id": 14,
      "eventId": 1,
      "namaEvent": "Penilaian Akhir Semester (PAS) Ganjil 2026/2027",
      "mapelId": 3,
      "namaMapel": "Pemrograman Perangkat Bergerak",
      "guruId": 12,
      "namaGuru": "Frian Prianas",
      "durasi": 90,
      "waktuMulai": "2026-09-18T07:30:00",
      "waktuSelesai": "2026-09-18T09:00:00",
      "isFinished": false,
      "sisaWaktuDetik": 5400,
      "tampilkanNilai": true,
      "nilaiAkhir": null,
      "namaKelas": "XII RPL 1, XII RPL 2"
    }
  ]
  ```

### Status Kartu Ujian Siswa di UI Flutter:
* Jika `isFinished == false`: Tampilkan tombol **"Ikuti Ujian"**.
* Jika `isFinished == true`: Ujian telah selesai. Jika `tampilkanNilai == true` dan `nilaiAkhir != null`, tampilkan badge nilai siswa.

---

## 4. Alur & Endpoint untuk Akun GURU

Guru akan melihat event ujian, daftar mata pelajaran yang didaftarkan olehnya, serta dapat melihat rekapitulasi kelas (jumlah siswa, jumlah yang menyelesaikan, dan jumlah yang belum).

### A. Mengambil Event Ujian Aktif
* **Endpoint**: `GET /api/exam/event/active`
* **Headers**: `Authorization: Bearer <TOKEN_GURU>`

---

### B. Mengambil Daftar Ujian / Mapel Guru pada Event Tersebut
* **Endpoint**: `GET /api/exam/ujian-mapel/event/{eventId}?guruId={guruId}`
* **Headers**: `Authorization: Bearer <TOKEN_GURU>`
* **Parameter Query**:
  - `guruId` *(opsional)*: ID guru dari hasil login (`profileId`). Jika diisi, hanya mengembalikan ujian yang dibuat oleh guru tersebut.
* **Contoh Request**: `GET /api/exam/ujian-mapel/event/1?guruId=12`
* **Response (HTTP 200 OK)**:
  ```json
  [
    {
      "id": 14,
      "eventId": 1,
      "namaEvent": "Penilaian Akhir Semester (PAS) Ganjil 2026/2027",
      "mapelId": 3,
      "namaMapel": "Pemrograman Perangkat Bergerak",
      "guruId": 12,
      "namaGuru": "Frian Prianas",
      "durasi": 90,
      "waktuMulai": "2026-09-18T07:30:00",
      "waktuSelesai": "2026-09-18T09:00:00",
      "token": "AB34XY",
      "tampilkanNilai": false,
      "namaKelas": "XII RPL 1, XII RPL 2"
    }
  ]
  ```

---

### C. Saat Mapel/Ujian Diklik -> Rekapitulasi Kelas (Summary)
Endpoint ini secara khusus dibuatkan untuk kebutuhan mobile Flutter agar langsung mendapatkan nama kelas, jumlah siswa total, jumlah yang sudah selesai, dan jumlah yang belum menyelesaikan.

* **Endpoint**: `GET /api/exam/ujian-mapel/{ujianId}/summary`
* **Headers**: `Authorization: Bearer <TOKEN_GURU>`
* **Contoh Request**: `GET /api/exam/ujian-mapel/14/summary`
* **Response (HTTP 200 OK)**:
  ```json
  {
    "ujianId": 14,
    "namaMapel": "Pemrograman Perangkat Bergerak",
    "namaGuru": "Frian Prianas",
    "totalSiswa": 72,
    "totalSelesai": 45,
    "totalBelum": 27,
    "kelasList": [
      {
        "kelasId": 1,
        "namaKelas": "XII RPL 1",
        "jumlahSiswa": 36,
        "jumlahSelesai": 25,
        "jumlahBelum": 11
      },
      {
        "kelasId": 2,
        "namaKelas": "XII RPL 2",
        "jumlahSiswa": 36,
        "jumlahSelesai": 20,
        "jumlahBelum": 16
      }
    ]
  }
  ```

---

## 5. Contoh Kode Implementasi Flutter (Dart)

### A. Model Data Dart untuk Summary Kelas Guru
```dart
class ExamClassSummary {
  final int ujianId;
  final String namaMapel;
  final String namaGuru;
  final int totalSiswa;
  final int totalSelesai;
  final int totalBelum;
  final List<ClassSummaryItem> kelasList;

  ExamClassSummary({
    required this.ujianId,
    required this.namaMapel,
    required this.namaGuru,
    required this.totalSiswa,
    required this.totalSelesai,
    required this.totalBelum,
    required this.kelasList,
  });

  factory ExamClassSummary.fromJson(Map<String, dynamic> json) {
    return ExamClassSummary(
      ujianId: json['ujianId'] ?? 0,
      namaMapel: json['namaMapel'] ?? '',
      namaGuru: json['namaGuru'] ?? '',
      totalSiswa: json['totalSiswa'] ?? 0,
      totalSelesai: json['totalSelesai'] ?? 0,
      totalBelum: json['totalBelum'] ?? 0,
      kelasList: (json['kelasList'] as List? ?? [])
          .map((item) => ClassSummaryItem.fromJson(item))
          .toList(),
    );
  }
}

class ClassSummaryItem {
  final int? kelasId;
  final String namaKelas;
  final int jumlahSiswa;
  final int jumlahSelesai;
  final int jumlahBelum;

  ClassSummaryItem({
    this.kelasId,
    required this.namaKelas,
    required this.jumlahSiswa,
    required this.jumlahSelesai,
    required this.jumlahBelum,
  });

  factory ClassSummaryItem.fromJson(Map<String, dynamic> json) {
    return ClassSummaryItem(
      kelasId: json['kelasId'],
      namaKelas: json['namaKelas'] ?? '',
      jumlahSiswa: json['jumlahSiswa'] ?? 0,
      jumlahSelesai: json['jumlahSelesai'] ?? 0,
      jumlahBelum: json['jumlahBelum'] ?? 0,
    );
  }
}
```

---

### B. Service Client di Flutter (Dio / Http)
```dart
import 'package:dio/dio.dart';

class BaknusExamService {
  final Dio _dio = Dio(BaseOptions(
    baseUrl: 'https://baknusclass.smkbn666.sch.id',
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 15),
  ));

  // 1. Login menggunakan kredensial Mailcow
  Future<Map<String, dynamic>> login(String username, String password) async {
    final response = await _dio.post('/api/auth/login', data: {
      'username': username,
      'password': password,
    });
    return response.data;
  }

  // 2. Ambil Rekapitulasi Kelas untuk Guru
  Future<ExamClassSummary> getExamSummary(int ujianId, String token) async {
    final response = await _dio.get(
      '/api/exam/ujian-mapel/$ujianId/summary',
      options: Options(headers: {
        'Authorization': 'Bearer $token',
      }),
    );
    return ExamClassSummary.fromJson(response.data);
  }

  // 3. Ambil Daftar Ujian untuk Siswa
  Future<List<dynamic>> getStudentExams(int eventId, String token) async {
    final response = await _dio.get(
      '/api/exam/ujian-mapel/siswa',
      queryParameters: {'eventId': eventId},
      options: Options(headers: {
        'Authorization': 'Bearer $token',
      }),
    );
    return response.data;
  }
}
```

---

## 6. Daftar Kode Status HTTP yang Perlu Di-handle

| HTTP Code | Arti | Tindakan di Flutter |
| :--- | :--- | :--- |
| **200 OK** | Permintaan berhasil | Parse data JSON dan render ke UI |
| **401 Unauthorized** | Token kedaluwarsa atau username/password salah | Tampilkan notifikasi "Kredensial Mailcow Salah" atau arahkan ke Layar Login |
| **403 Forbidden** | Role tidak memiliki akses (misal siswa mencoba akses summary guru) | Tampilkan pesan "Akses ditolak" |
| **404 Not Found** | Data ujian atau event tidak ditemukan | Tampilkan state kosong / empty list |
| **500 Internal Error** | Kendala pada server sekolah | Tampilkan notifikasi coba beberapa saat lagi |
