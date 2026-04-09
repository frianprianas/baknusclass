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
                        if (lLower.contains("nama") || lLower.contains("name")) {
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

                for (String line : lines) {
                    try {
                        String[] parts;
                        if (line.contains(";")) {
                            parts = line.split(";", -1);
                        } else {
                            parts = line.split(",", -1);
                        }

                        if (parts.length < 2) {
                            throw new Exception("Kolom kurang. Harap isi Nama dan Kelas");
                        }

                        String nama = parts[0].trim();
                        String kelasStr = parts[1].trim();

                        // Find or create Kelas
                        Kelas kelas = kelasRepository.findByNamaKelasIgnoreCase(kelasStr).orElse(null);
                        if (kelas == null) {
                            Jurusan defaultJurusan = jurusanRepository.findAll().stream().findFirst().orElseGet(() -> {
                                Jurusan j = new Jurusan();
                                j.setKodeJurusan("UMUM");
                                j.setNamaJurusan("Umum");
                                return jurusanRepository.save(j);
                            });

                            kelas = new Kelas();
                            kelas.setNamaKelas(kelasStr);
                            kelas.setTingkat("X"); // Default
                            kelas.setJurusan(defaultJurusan);
                            kelas = kelasRepository.save(kelas);
                        }

                        // Buat username & email
                        String cleanName = nama.toLowerCase().replaceAll("[^a-z0-9]", "");
                        if (cleanName.length() > 10) cleanName = cleanName.substring(0, 10);
                        String suffix = String.format("%04d", new Random().nextInt(10000));
                        String username = "s." + cleanName + suffix;
                        String email = username + "@student.baknus";

                        // Check existing
                        Optional<Users> userOpt = userRepository.findByEmail(email);
                        Users user;
                        if (userOpt.isEmpty()) {
                            user = new Users();
                            user.setEmail(email);
                            user.setUsername(username);
                            user.setPasswordHash(passwordEncoder.encode("123456"));
                            user.setRole("SISWA");
                            user.setNamaLengkap(nama);
                            user.setIsActive(true);
                            user = userRepository.save(user);
                        } else {
                            user = userOpt.get();
                        }

                        String nisn = String.valueOf(System.currentTimeMillis()).substring(3) + new Random().nextInt(100);

                        Siswa siswa = new Siswa();
                        siswa.setUser(user);
                        siswa.setNamaLengkap(nama);
                        siswa.setKelas(kelas);
                        siswa.setNisn(nisn);
                        siswaRepository.save(siswa);

                        success++;
                        processed++;

                        Map<String, Object> eventData = new HashMap<>();
                        eventData.put("progress", processed);
                        eventData.put("total", total);
                        eventData.put("message", "[OK] Tersinkron: " + nama + " -> Kelas " + kelasStr);

                        emitter.send(SseEmitter.event().name("progress").data(eventData));

                        Thread.sleep(80); // Small delay for UI and not blasting DB

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
}
