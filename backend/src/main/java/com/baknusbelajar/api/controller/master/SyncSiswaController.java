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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
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
    private final PlatformTransactionManager transactionManager;

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
                return ResponseEntity.badRequest().body(Map.of("message", "File CSV kosong atau format header salah"));
            }

            String jobId = UUID.randomUUID().toString();
            jobs.put(jobId, lines);

            return ResponseEntity.ok(Map.of(
                    "jobId", jobId,
                    "totalLines", lines.size(),
                    "message", "Upload berhasil. Siap melakukan streaming sinkronisasi."
            ));

        } catch (Exception e) {
            log.error("Error upload sync CSV", e);
            return ResponseEntity.status(500).body(Map.of("message", "Gagal membaca CSV: " + e.getMessage()));
        }
    }

    @GetMapping("/stream/{jobId}")
    public SseEmitter streamProgress(@PathVariable("jobId") String jobId) {
        SseEmitter emitter = new SseEmitter(10 * 60 * 1000L); // 10 minutes timeout

        List<String> lines = jobs.remove(jobId);
        if (lines == null) {
            try {
                emitter.send(SseEmitter.event().name("error").data("ID Job tidak valid atau sudah kadaluwarsa"));
                emitter.complete();
            } catch (Exception ignored) {}
            return emitter;
        }

        ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.execute(() -> {
            try {
                TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);

                int total = lines.size();
                int processed = 0;
                int success = 0;
                int failed = 0;

                // Cache all siswa from DB with eagerly fetched User and Kelas
                List<Siswa> allSiswa = txTemplate.execute(status -> siswaRepository.findAllWithUserAndKelas());
                if (allSiswa == null) {
                    allSiswa = Collections.emptyList();
                }

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
                        processed++;
                        String[] parts = line.split("[;,]");
                        if (parts.length < 2) {
                            failed++;
                            try {
                                Map<String, Object> eventData = new HashMap<>();
                                eventData.put("progress", processed);
                                eventData.put("total", total);
                                eventData.put("message", "[WARNING] Format baris tidak valid: " + line);
                                emitter.send(SseEmitter.event().name("progress").data(eventData));
                            } catch (Exception ex) {}
                            continue;
                        }

                        String nis = "";
                        String nama = "";
                        String kelasStr = "";

                        if (parts.length >= 4) {
                            // Format 4 kolom: No;NIS;Nama;Kelas
                            nis = parts[1].trim();
                            nama = parts[2].trim();
                            kelasStr = parts[3].trim();
                        } else if (parts.length == 3) {
                            // Format 3 kolom: NIS;Nama;Kelas ATAU No;Nama;Kelas
                            String col0 = parts[0].trim();
                            String col1 = parts[1].trim();
                            String col2 = parts[2].trim();
                            if (col0.matches("^\\d{5,}$")) {
                                nis = col0;
                                nama = col1;
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

                        final String finalNis = nis;
                        final String finalNama = nama;
                        final String finalKelasStr = kelasStr;
                        final List<Siswa> targets = existingSiswa;

                        // Eksekusi DB update dalam transaksi
                        String successMsg = txTemplate.execute(status -> {
                            // Normalisasi nama kelas (misal: RPL -> PPLG)
                            String normalizedKelasStr = finalKelasStr.replaceAll("(?i)\\bRPL\\b", "PPLG").trim();

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
                            for (Siswa s : targets) {
                                Siswa attached = siswaRepository.findById(s.getId()).orElse(s);
                                attached.setKelas(kelas);
                                if (!finalNis.isEmpty()) {
                                    attached.setNisn(finalNis);
                                }
                                if (!finalNama.isEmpty() && !finalNama.equalsIgnoreCase(attached.getNamaLengkap())) {
                                    attached.setNamaLengkap(finalNama);
                                    if (attached.getUser() != null) {
                                        attached.getUser().setNamaLengkap(finalNama);
                                        userRepository.save(attached.getUser());
                                    }
                                }
                                siswaRepository.save(attached);
                            }

                            String displayLabel = !finalNama.isEmpty() ? finalNama : ("NIS " + finalNis);
                            return "[OK] Berhasil disinkron: " + displayLabel + (!finalNis.isEmpty() ? (" (" + finalNis + ")") : "") + " -> Kelas " + normalizedKelasStr;
                        });

                        success++;
                        Map<String, Object> eventData = new HashMap<>();
                        eventData.put("progress", processed);
                        eventData.put("total", total);
                        eventData.put("message", successMsg);

                        emitter.send(SseEmitter.event().name("progress").data(eventData));

                        Thread.sleep(60); // Delay untuk visualisasi stream di UI

                    } catch (Exception e) {
                        failed++;
                        try {
                            Map<String, Object> eventData = new HashMap<>();
                            eventData.put("progress", processed);
                            eventData.put("total", total);
                            eventData.put("message", "[ERROR] Gagal baris " + processed + ": " + e.getMessage());
                            emitter.send(SseEmitter.event().name("progress").data(eventData));
                        } catch (Exception ex) {}
                    }
                }

                Map<String, Object> doneData = new HashMap<>();
                doneData.put("success", success);
                doneData.put("failed", failed);
                doneData.put("total", total);
                doneData.put("message", "Sinkronisasi selesai!");

                emitter.send(SseEmitter.event().name("complete").data(doneData));
                emitter.complete();

            } catch (Exception e) {
                log.error("Fatal error during stream processing", e);
                try {
                    emitter.send(SseEmitter.event().name("error").data("Terjadi kesalahan sistem: " + e.getMessage()));
                    emitter.complete();
                } catch (Exception ignored) {}
            } finally {
                executor.shutdown();
            }
        });

        return emitter;
    }

    @PostMapping("/deep-sync")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> deepSyncDuplicates() {
        try {
            List<Siswa> allSiswa = siswaRepository.findAllWithUserAndKelas();
            Map<String, List<Siswa>> grouped = new HashMap<>();

            for (Siswa s : allSiswa) {
                String key = null;
                if (s.getNamaLengkap() != null) {
                    key = s.getNamaLengkap().trim().toLowerCase();
                } else if (s.getUser() != null && s.getUser().getEmail() != null) {
                    key = s.getUser().getEmail().trim().toLowerCase();
                }

                if (key != null) {
                    grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
                }
            }

            int mergedCount = 0;
            int deletedCount = 0;

            for (Map.Entry<String, List<Siswa>> entry : grouped.entrySet()) {
                List<Siswa> group = entry.getValue();
                if (group.size() <= 1) continue;

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
                        newKelas = s.getKelas();
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
            
            for (int i = 1; i < lines.size(); i++) {
                String line = lines.get(i);
                if (line.trim().isEmpty()) continue;
                String[] parts = line.split("[;,]");
                if (parts.length < 3) continue;
                
                String nis = parts[1].trim();
                String nama = parts[2].trim();
                String kelasStr = parts.length >= 4 ? parts[3].trim() : parts[parts.length - 1].trim();
                
                String normalizedKelasStr = kelasStr.replaceAll("(?i)\\bRPL\\b", "PPLG").trim();
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
                
                java.util.Optional<Siswa> existing = siswaRepository.findByNisn(nis);
                if (existing.isPresent()) {
                    Siswa s = existing.get();
                    s.setKelas(kelas);
                    s.setNamaLengkap(nama);
                    if (s.getUser() != null) {
                        s.getUser().setNamaLengkap(nama);
                        userRepository.save(s.getUser());
                    }
                    siswaRepository.save(s);
                }
                success++;
            }
            
            return ResponseEntity.ok(Map.of("message", "Hard sync selesai", "success", success));
        } catch (Exception e) {
            log.error("Hard sync error", e);
            return ResponseEntity.status(500).body(Map.of("message", "Gagal hard sync: " + e.getMessage()));
        }
    }
}
