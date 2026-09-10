package com.baknusbelajar.api.controller.master;

import com.baknusbelajar.api.entity.Jurusan;
import com.baknusbelajar.api.entity.Kelas;
import com.baknusbelajar.api.entity.Siswa;
import com.baknusbelajar.api.entity.Users;
import com.baknusbelajar.api.repository.JurusanRepository;
import com.baknusbelajar.api.repository.KelasRepository;
import com.baknusbelajar.api.repository.SiswaRepository;
import com.baknusbelajar.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@RestController
@RequestMapping("/api/master/sync-siswa")
@RequiredArgsConstructor
public class SyncSiswaController {

    private final UserRepository userRepository;
    private final SiswaRepository siswaRepository;
    private final KelasRepository kelasRepository;
    private final JurusanRepository jurusanRepository;
    private final PasswordEncoder passwordEncoder;

    // In-memory job storage: jobId -> List of lines
    private final Map<String, List<String>> jobs = new ConcurrentHashMap<>();

    @PostMapping("/upload")
    public ResponseEntity<?> uploadCsv(@RequestParam("file") MultipartFile file) {
        try {
            List<String> lines = new ArrayList<>();
            try (BufferedReader br = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
                String line;
                boolean isFirst = true;
                while ((line = br.readLine()) != null) {
                    if (line.trim().isEmpty()) continue;
                    if (isFirst) {
                        String lLower = line.toLowerCase();
                        if (lLower.contains("nama") || lLower.contains("name") || lLower.contains("kelas") || lLower.contains("nis")) {
                            isFirst = false;
                            continue;
                        }
                        isFirst = false;
                    }
                    lines.add(line);
                }
            }

            if (lines.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "File kosong atau format salah"));
            }

            String jobId = UUID.randomUUID().toString();
            jobs.put(jobId, lines);

            return ResponseEntity.ok(Map.of("jobId", jobId, "totalLines", lines.size()));
        } catch (Exception e) {
            log.error("Error reading CSV", e);
            return ResponseEntity.status(500).body(Map.of("message", "Error: " + e.getMessage()));
        }
    }

    @GetMapping("/stream")
    public SseEmitter streamProgress(@RequestParam("jobId") String jobId) {
        SseEmitter emitter = new SseEmitter(300_000L); // 5 minutes timeout
        List<String> lines = jobs.get(jobId);

        if (lines == null) {
            try {
                emitter.send(SseEmitter.event().name("error").data("Job ID tidak ditemukan"));
                emitter.complete();
            } catch (Exception e) {}
            return emitter;
        }

        ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.execute(() -> {
            try {
                int total = lines.size();
                int processed = 0;
                int success = 0;
                int failed = 0;

                // Cache all siswa from DB
                List<Siswa> allSiswa = siswaRepository.findAll();
                Map<String, List<Siswa>> nisMap = new HashMap<>();
                Map<String, List<Siswa>> nameMap = new HashMap<>();

                for (Siswa s : allSiswa) {
                    // 1. Index by NISN jika tersedia
                    if (s.getNisn() != null && !s.getNisn().trim().isEmpty()) {
                        String k = s.getNisn().trim().toLowerCase();
                        nisMap.computeIfAbsent(k, x -> new ArrayList<>()).add(s);
                    }

                    // 2. Index by User's username & email (misal: 2526019070001@smk.baktinusantara666.sch.id)
                    if (s.getUser() != null) {
                        String uName = s.getUser().getUsername();
                        if (uName != null && !uName.trim().isEmpty()) {
                            String uClean = uName.trim().toLowerCase();
                            nisMap.computeIfAbsent(uClean, x -> new ArrayList<>()).add(s);
                            if (uClean.contains("@")) {
                                String prefix = uClean.split("@")[0].trim();
                                nisMap.computeIfAbsent(prefix, x -> new ArrayList<>()).add(s);
                            }
                        }

                        String uEmail = s.getUser().getEmail();
                        if (uEmail != null && !uEmail.trim().isEmpty()) {
                            String eClean = uEmail.trim().toLowerCase();
                            nisMap.computeIfAbsent(eClean, x -> new ArrayList<>()).add(s);
                            if (eClean.contains("@")) {
                                String prefix = eClean.split("@")[0].trim();
                                nisMap.computeIfAbsent(prefix, x -> new ArrayList<>()).add(s);
                            }
                        }
                    }

                    // 3. Index by Nama Lengkap (sebagai fallback)
                    if (s.getNamaLengkap() != null) {
                        String key = s.getNamaLengkap().trim().toLowerCase();
                        nameMap.computeIfAbsent(key, x -> new ArrayList<>()).add(s);
                    }
                }

                for (String line : lines) {
                    try {
                        String[] parts;
                        if (line.contains(";")) {
                            parts = line.split(";", -1);
                        } else {
                            parts = line.split(",", -1);
                        }

                        if (parts.length < 2) {
                            throw new Exception("Kolom kurang. Harap isi data Nama dan Kelas");
                        }

                        String nis = "";
                        String nama = "";
                        String kelasStr = "";

                        if (parts.length >= 4) {
                            // Format: No;NIS;Nama;Kelas atau sejenisnya
                            String col1 = parts[1].trim(); // Kemungkinan NIS
                            String col2 = parts[2].trim(); // Kemungkinan Nama
                            String col3 = parts[3].trim(); // Kemungkinan Kelas
                            
                            if (col1.matches("^\\d{5,}$")) {
                                nis = col1;
                                nama = col2;
                                kelasStr = col3;
                            } else if (parts[0].trim().matches("^\\d{5,}$")) {
                                nis = parts[0].trim();
                                nama = col1;
                                kelasStr = col2;
                            } else {
                                nama = col1;
                                kelasStr = col2;
                            }
                        } else if (parts.length == 3) {
                            // Format: NIS;Nama;Kelas atau No;Nama;Kelas
                            String col0 = parts[0].trim();
                            String col1 = parts[1].trim();
                            String col2 = parts[2].trim();
                            
                            if (col0.matches("^\\d{5,}$")) {
                                nis = col0;
                                nama = col1;
                                kelasStr = col2;
                            } else if (col1.matches("^\\d{5,}$")) {
                                nis = col1;
                                nama = col0;
                                kelasStr = col2;
                            } else {
                                nama = col1;
                                kelasStr = col2;
                            }
                        } else {
                            // Format 2 kolom: Nama;Kelas atau NIS;Kelas
                            String col0 = parts[0].trim();
                            String col1 = parts[1].trim();
                            if (col0.matches("^\\d{5,}$")) {
                                nis = col0;
                            } else {
                                nama = col0;
                            }
                            kelasStr = col1;
                        }

                        if (kelasStr.isEmpty()) {
                            throw new Exception("Nama kelas tidak boleh kosong");
                        }

                        // Cari siswa: Prioritas 1 = NIS (akurat 100%), Prioritas 2 = Nama Lengkap
                        List<Siswa> existingSiswa = null;

                        if (!nis.isEmpty()) {
                            existingSiswa = nisMap.get(nis.toLowerCase());
                        }

                        if ((existingSiswa == null || existingSiswa.isEmpty()) && !nama.isEmpty()) {
                            existingSiswa = nameMap.get(nama.toLowerCase());
                        }

                        if (existingSiswa == null || existingSiswa.isEmpty()) {
                            failed++;
                            processed++;
                            try {
                                Map<String, Object> eventData = new HashMap<>();
                                eventData.put("progress", processed);
                                eventData.put("total", total);
                                String ident = !nis.isEmpty() ? ("NIS " + nis + " (" + nama + ")") : nama;
                                eventData.put("message", "[WARNING] " + ident + " tidak ditemukan di database aplikasi.");
                                emitter.send(SseEmitter.event().name("progress").data(eventData));
                            } catch (Exception ex) {}
                            continue;
                        }

                        // Normalisasi nama kelas (misal: RPL -> PPLG)
                        String normalizedKelasStr = kelasStr.replaceAll("(?i)\\bRPL\\b", "PPLG").trim();

                        // Cari atau buat Kelas otomatis
                        Kelas kelas = kelasRepository.findByNamaKelasIgnoreCase(normalizedKelasStr).orElse(null);
                        if (kelas == null) {
                            String tingkat = "X";
                            if (normalizedKelasStr.contains(" ")) {
                                tingkat = normalizedKelasStr.split(" ")[0];
                            } else if (normalizedKelasStr.toUpperCase().startsWith("XII")) {
                                tingkat = "XII";
                            } else if (normalizedKelasStr.toUpperCase().startsWith("XI")) {
                                tingkat = "XI";
                            }

                            String jurusanPart = normalizedKelasStr.substring(tingkat.length()).trim();
                            String prodiName = jurusanPart.replaceAll("\\s+\\d+$", "").trim();
                            if (prodiName.equalsIgnoreCase("RPL")) prodiName = "PPLG";
                            if (prodiName.isEmpty()) prodiName = "UMUM";

                            final String targetProdi = prodiName;
                            Jurusan jurusan = jurusanRepository.findAll().stream()
                                    .filter(j -> j.getKodeJurusan().equalsIgnoreCase(targetProdi) || j.getNamaJurusan().equalsIgnoreCase(targetProdi))
                                    .findFirst().orElse(null);

                            if (jurusan == null) {
                                Jurusan j = new Jurusan();
                                j.setKodeJurusan(targetProdi.toUpperCase());
                                j.setNamaJurusan(targetProdi.toUpperCase());
                                jurusan = jurusanRepository.save(j);
                            }

                            kelas = new Kelas();
                            kelas.setNamaKelas(normalizedKelasStr);
                            kelas.setTingkat(tingkat);
                            kelas.setJurusan(jurusan);
                            kelas = kelasRepository.save(kelas);
                        }

                        // Update kelas dan sinkronisasi nama/nisn pada data siswa yang cocok
                        for (Siswa s : existingSiswa) {
                            s.setKelas(kelas);
                            if (!nis.isEmpty()) {
                                s.setNisn(nis);
                            }
                            if (!nama.isEmpty() && !nama.equalsIgnoreCase(s.getNamaLengkap())) {
                                s.setNamaLengkap(nama);
                                if (s.getUser() != null) {
                                    s.getUser().setNamaLengkap(nama);
                                    userRepository.save(s.getUser());
                                }
                            }
                            siswaRepository.save(s);
                        }

                        success++;
                        processed++;

                        Map<String, Object> eventData = new HashMap<>();
                        eventData.put("progress", processed);
                        eventData.put("total", total);
                        String displayLabel = !nama.isEmpty() ? nama : ("NIS " + nis);
                        eventData.put("message", "[OK] Berhasil disinkron: " + displayLabel + " (" + (!nis.isEmpty() ? nis : "") + ") -> Kelas " + normalizedKelasStr);

                        emitter.send(SseEmitter.event().name("progress").data(eventData));

                        Thread.sleep(60); // Small delay for UI and not blasting DB

                    } catch (Exception e) {
                        failed++;
                        processed++;
                        try {
                            Map<String, Object> eventData = new HashMap<>();
                            eventData.put("progress", processed);
                            eventData.put("total", total);
                            eventData.put("message", "[ERROR] Gagal sinkron baris (" + line + "): " + e.getMessage());
                            emitter.send(SseEmitter.event().name("progress").data(eventData));
                        } catch (Exception ex) {
                            // ignore
                        }
                    }
                }

                Map<String, Object> resultData = new HashMap<>();
                resultData.put("success", success);
                resultData.put("failed", failed);
                resultData.put("total", total);
                resultData.put("message", "[DONE] Sinkronisasi selesai. Berhasil: " + success + ", Gagal: " + failed);

                emitter.send(SseEmitter.event().name("complete").data(resultData));
                emitter.complete();
                jobs.remove(jobId);

            } catch (Exception e) {
                try {
                    emitter.send(SseEmitter.event().name("error").data("Terjadi kesalahan sistem: " + e.getMessage()));
                    emitter.completeWithError(e);
                } catch (Exception ex) {}
            }
        });

        return emitter;
    }

    @PostMapping("/deep-sync")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> deepSyncDuplicates() {
        try {
            List<Siswa> allSiswa = siswaRepository.findAll();
            
            // Group by lowercase namaLengkap
            Map<String, List<Siswa>> grouped = new HashMap<>();
            for (Siswa s : allSiswa) {
                if (s.getNamaLengkap() == null) continue;
                String key = s.getNamaLengkap().toLowerCase().trim();
                grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
            }

            int mergedCount = 0;
            int deletedCount = 0;

            for (Map.Entry<String, List<Siswa>> entry : grouped.entrySet()) {
                List<Siswa> group = entry.getValue();
                if (group.size() <= 1) continue;

                // Find primary (with email @smk.baktinusantara666.sch.id)
                Siswa primary = null;
                for (Siswa s : group) {
                    if (s.getUser() != null && s.getUser().getEmail() != null && 
                        s.getUser().getEmail().endsWith("@smk.baktinusantara666.sch.id")) {
                        primary = s;
                        break;
                    }
                }

                if (primary == null) continue;

                Kelas newKelas = null;
                List<Siswa> toDelete = new ArrayList<>();

                for (Siswa s : group) {
                    if (s.getId().equals(primary.getId())) continue;
                    
                    if (s.getKelas() != null) {
                        newKelas = s.getKelas(); // ambil kelas dari data duplikat (hasil csv)
                    }
                    toDelete.add(s);
                }

                if (newKelas != null) {
                    primary.setKelas(newKelas);
                    siswaRepository.save(primary);
                    mergedCount++;
                }

                for (Siswa dupe : toDelete) {
                    Users dupeUser = dupe.getUser();
                    siswaRepository.delete(dupe);
                    if (dupeUser != null) {
                        userRepository.delete(dupeUser);
                    }
                    deletedCount++;
                }
            }

            return ResponseEntity.ok(Map.of(
                "message", "Sinkronisasi mendalam berhasil. Memperbarui " + mergedCount + " siswa dan menghapus " + deletedCount + " duplikat.",
                "mergedCount", mergedCount,
                "deletedCount", deletedCount
            ));
        } catch (Exception e) {
            log.error("Deep sync error", e);
            return ResponseEntity.status(500).body(Map.of("message", "Gagal sinkronisasi mendalam: " + e.getMessage()));
        }
    }
    
    @PostMapping("/hard-sync")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> hardSync(@RequestParam("file") MultipartFile file) {
        try {
            java.util.List<String> lines = new java.util.ArrayList<>();
            try (java.io.BufferedReader br = new java.io.BufferedReader(new java.io.InputStreamReader(file.getInputStream()))) {
                String l;
                while ((l = br.readLine()) != null) {
                    lines.add(l);
                }
            }
            int success = 0;
            int failed = 0;
            
            for (int i = 1; i < lines.size(); i++) {
                String line = lines.get(i);
                if (line.trim().isEmpty()) continue;
                String[] parts = line.split(";");
                if (parts.length < 6) continue;
                
                String nis = parts[1].trim();
                String nama = parts[2].trim();
                String kelasStr = parts[3].trim();
                String email = parts[4].trim();
                
                // Ganti RPL jadi PPLG jika ada
                String kelasStrNormalized = kelasStr.replaceAll("(?i)\\bRPL\\b", "PPLG");
                
                // 1. Resolve Kelas
                Kelas kelas = kelasRepository.findByNamaKelasIgnoreCase(kelasStrNormalized).orElse(null);
                if (kelas == null) {
                    String tingkat = kelasStrNormalized.split(" ")[0]; // "XII"
                    String jurusanStr = kelasStrNormalized.substring(tingkat.length()).trim(); // "PPLG 1" or "PPLG"
                    
                    // Ekstrak nama prodi tanpa nomor
                    String prodiName = jurusanStr.replaceAll("\\s+\\d+$", "").trim();
                    if (prodiName.equalsIgnoreCase("RPL")) {
                        prodiName = "PPLG";
                    }
                    
                    final String targetProdi = prodiName;
                    
                    // fetch all and ignore case
                    java.util.List<Jurusan> allJurusans = jurusanRepository.findAll();
                    Jurusan jurusan = allJurusans.stream()
                            .filter(j -> j.getKodeJurusan().equalsIgnoreCase(targetProdi))
                            .findFirst().orElse(null);
                            
                    if (jurusan == null) {
                        Jurusan j = new Jurusan();
                        j.setKodeJurusan(prodiName);
                        j.setNamaJurusan(prodiName);
                        jurusan = jurusanRepository.save(j);
                    }
                    
                    kelas = new Kelas();
                    kelas.setNamaKelas(kelasStrNormalized);
                    kelas.setTingkat(tingkat);
                    kelas.setJurusan(jurusan);
                    kelas = kelasRepository.save(kelas);
                }
                
                // 2. Resolve User
                Users user = userRepository.findByUsername(nis).orElse(null);
                if (user == null) {
                    user = userRepository.findByEmail(email).orElse(null);
                }
                
                boolean isNewUser = (user == null);
                if (isNewUser) {
                    user = new Users();
                    user.setUsername(nis);
                }
                
                if (parts.length >= 6 && !parts[5].trim().isEmpty()) {
                    user.setPasswordHash(passwordEncoder.encode(parts[5].trim()));
                } else if (isNewUser || user.getPasswordHash() == null) {
                    user.setPasswordHash(passwordEncoder.encode(java.util.UUID.randomUUID().toString()));
                }
                
                user.setEmail(email);
                user.setNamaLengkap(nama);
                user.setRole("SISWA");
                user.setIsActive(true);
                user = userRepository.save(user);
                
                // 3. Resolve Siswa
                Siswa primary = null;
                Siswa byNisn = siswaRepository.findByNisn(nis).orElse(null);
                Siswa byUserId = siswaRepository.findByUserId(user.getId()).orElse(null);
                
                if (byNisn != null) primary = byNisn;
                else if (byUserId != null) primary = byUserId;
                else primary = new Siswa();
                
                // Delete duplicate if they are different entities
                if (byNisn != null && byUserId != null && !byNisn.getId().equals(byUserId.getId())) {
                    siswaRepository.delete(byUserId);
                }
                
                primary.setNisn(nis);
                primary.setNamaLengkap(nama);
                primary.setKelas(kelas);
                primary.setUser(user);
                siswaRepository.save(primary);
                
                success++;
            }
            
            return ResponseEntity.ok(Map.of("message", "Hard sync selesai", "success", success));
        } catch (Exception e) {
            log.error("Hard sync error", e);
            return ResponseEntity.status(500).body(Map.of("message", "Error: " + e.getMessage()));
        }
    }
}
