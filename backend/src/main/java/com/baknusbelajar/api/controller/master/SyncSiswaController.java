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
                        if (lLower.contains("nama") || lLower.contains("name") || lLower.contains("kelas") || lLower.contains("nis") || lLower.contains("username") || lLower.contains("email")) {
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

    @GetMapping(value = {"/stream", "/stream/{jobId}"})
    public SseEmitter streamProgress(
            @RequestParam(value = "jobId", required = false) String paramJobId,
            @PathVariable(value = "jobId", required = false) String pathJobId
    ) {
        String jobId = (paramJobId != null && !paramJobId.trim().isEmpty()) ? paramJobId : pathJobId;
        SseEmitter emitter = new SseEmitter(15 * 60 * 1000L); // 15 minutes timeout

        if (jobId == null || !jobs.containsKey(jobId)) {
            try {
                emitter.send(SseEmitter.event().name("error").data("ID Job tidak valid atau sudah kadaluwarsa"));
                emitter.complete();
            } catch (Exception ignored) {}
            return emitter;
        }

        List<String> lines = jobs.remove(jobId);

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
                Map<String, List<Siswa>> emailMap = new HashMap<>();
                Map<String, List<Siswa>> nameMap = new HashMap<>();

                for (Siswa s : allSiswa) {
                    // 1. Index by NISN jika tersedia
                    if (s.getNisn() != null && !s.getNisn().trim().isEmpty()) {
                        String k = s.getNisn().trim().toLowerCase();
                        nisMap.computeIfAbsent(k, x -> new ArrayList<>()).add(s);
                    }

                    // 2. Index by User's username & email
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
                            emailMap.computeIfAbsent(eClean, x -> new ArrayList<>()).add(s);
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
                        ParsedRow row = parseRow(line);
                        if (row == null || row.kelasStr.isEmpty()) {
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

                        // Eksekusi DB update dalam transaksi
                        String successMsg = txTemplate.execute(status -> syncStudentRow(row, nisMap, emailMap, nameMap));

                        success++;
                        Map<String, Object> eventData = new HashMap<>();
                        eventData.put("progress", processed);
                        eventData.put("total", total);
                        eventData.put("message", successMsg);

                        emitter.send(SseEmitter.event().name("progress").data(eventData));

                        Thread.sleep(30); // Delay untuk visualisasi stream di UI

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

            List<Siswa> allSiswa = siswaRepository.findAllWithUserAndKelas();
            Map<String, List<Siswa>> nisMap = new HashMap<>();
            Map<String, List<Siswa>> emailMap = new HashMap<>();
            Map<String, List<Siswa>> nameMap = new HashMap<>();

            for (Siswa s : allSiswa) {
                if (s.getNisn() != null && !s.getNisn().trim().isEmpty()) {
                    nisMap.computeIfAbsent(s.getNisn().trim().toLowerCase(), x -> new ArrayList<>()).add(s);
                }
                if (s.getUser() != null) {
                    if (s.getUser().getUsername() != null) {
                        nisMap.computeIfAbsent(s.getUser().getUsername().trim().toLowerCase(), x -> new ArrayList<>()).add(s);
                    }
                    if (s.getUser().getEmail() != null) {
                        emailMap.computeIfAbsent(s.getUser().getEmail().trim().toLowerCase(), x -> new ArrayList<>()).add(s);
                        nisMap.computeIfAbsent(s.getUser().getEmail().trim().toLowerCase(), x -> new ArrayList<>()).add(s);
                    }
                }
                if (s.getNamaLengkap() != null) {
                    nameMap.computeIfAbsent(s.getNamaLengkap().trim().toLowerCase(), x -> new ArrayList<>()).add(s);
                }
            }

            int startIdx = 0;
            if (!lines.isEmpty()) {
                String header = lines.get(0).toLowerCase();
                if (header.contains("nama") || header.contains("kelas") || header.contains("nis") || header.contains("username") || header.contains("email")) {
                    startIdx = 1;
                }
            }
            
            for (int i = startIdx; i < lines.size(); i++) {
                String line = lines.get(i);
                if (line.trim().isEmpty()) continue;
                ParsedRow row = parseRow(line);
                if (row == null || row.kelasStr.isEmpty()) continue;
                
                syncStudentRow(row, nisMap, emailMap, nameMap);
                success++;
            }
            
            return ResponseEntity.ok(Map.of("message", "Hard sync selesai", "success", success));
        } catch (Exception e) {
            log.error("Hard sync error", e);
            return ResponseEntity.status(500).body(Map.of("message", "Gagal hard sync: " + e.getMessage()));
        }
    }

    public static class ParsedRow {
        public String nis = "";
        public String username = "";
        public String email = "";
        public String nama = "";
        public String kelasStr = "";
        public String password = "";
    }

    private ParsedRow parseRow(String line) {
        if (line == null || line.trim().isEmpty()) return null;
        String[] parts = line.contains(";") ? line.split(";") : line.split(",");
        if (parts.length < 2) return null;

        String nis = "";
        String email = "";
        String nama = "";
        String kelasStr = "";
        String password = "";

        if (parts.length >= 6) {
            if (parts[2].contains("@")) {
                // Format: No;username;email;Nama;Kelas;Password (sesuai kls x mentah.csv)
                nis = parts[1].trim();
                email = parts[2].trim();
                nama = parts[3].trim();
                kelasStr = parts[4].trim();
                password = parts[5].trim();
            } else if (parts[4].contains("@")) {
                // Format: No;NIS;Nama;Kelas;Email;Password
                nis = parts[1].trim();
                nama = parts[2].trim();
                kelasStr = parts[3].trim();
                email = parts[4].trim();
                password = parts[5].trim();
            } else {
                nis = parts[1].trim();
                email = parts[2].trim();
                nama = parts[3].trim();
                kelasStr = parts[4].trim();
                password = parts[5].trim();
            }
        } else if (parts.length == 5) {
            if (parts[1].contains("@")) {
                // username;email;Nama;Kelas;Password
                nis = parts[0].trim();
                email = parts[1].trim();
                nama = parts[2].trim();
                kelasStr = parts[3].trim();
                password = parts[4].trim();
            } else if (parts[2].contains("@")) {
                // No;username;email;Nama;Kelas
                nis = parts[1].trim();
                email = parts[2].trim();
                nama = parts[3].trim();
                kelasStr = parts[4].trim();
            } else if (parts[4].contains("@")) {
                // No;NIS;Nama;Kelas;Email
                nis = parts[1].trim();
                nama = parts[2].trim();
                kelasStr = parts[3].trim();
                email = parts[4].trim();
            } else {
                // No;NIS;Nama;Kelas;Password
                nis = parts[1].trim();
                nama = parts[2].trim();
                kelasStr = parts[3].trim();
                password = parts[4].trim();
            }
        } else if (parts.length == 4) {
            if (parts[1].contains("@")) {
                // No;email;Nama;Kelas
                email = parts[1].trim();
                nis = email.split("@")[0].trim();
                nama = parts[2].trim();
                kelasStr = parts[3].trim();
            } else if (parts[0].contains("@")) {
                // email;Nama;Kelas;Password
                email = parts[0].trim();
                nis = email.split("@")[0].trim();
                nama = parts[1].trim();
                kelasStr = parts[2].trim();
                password = parts[3].trim();
            } else {
                // Standar 4 kolom: No;NIS;Nama;Kelas
                nis = parts[1].trim();
                nama = parts[2].trim();
                kelasStr = parts[3].trim();
            }
        } else if (parts.length == 3) {
            String col0 = parts[0].trim();
            String col1 = parts[1].trim();
            String col2 = parts[2].trim();
            if (col0.contains("@")) {
                email = col0;
                nis = email.split("@")[0].trim();
                nama = col1;
                kelasStr = col2;
            } else if (col0.matches("^\\d{5,}$")) {
                nis = col0;
                nama = col1;
                kelasStr = col2;
            } else {
                nama = col1;
                kelasStr = col2;
            }
        } else {
            // 2 kolom
            String col0 = parts[0].trim();
            String col1 = parts[1].trim();
            if (col0.contains("@")) {
                email = col0;
                nis = email.split("@")[0].trim();
            } else if (col0.matches("^\\d{5,}$")) {
                nis = col0;
            } else {
                nama = col0;
            }
            kelasStr = col1;
        }

        if (email.isEmpty() && !nis.isEmpty() && nis.matches("^\\d{5,}$")) {
            email = nis + "@smk.baktinusantara666.sch.id";
        }
        if (nis.isEmpty() && !email.isEmpty()) {
            nis = email.split("@")[0].trim();
        }
        String username = !nis.isEmpty() ? nis : (!email.isEmpty() ? email.split("@")[0].trim() : "");

        ParsedRow row = new ParsedRow();
        row.nis = nis;
        row.username = username;
        row.email = email;
        row.nama = nama;
        row.kelasStr = kelasStr;
        row.password = password;
        return row;
    }

    private Kelas getOrCreateKelas(String finalKelasStr) {
        String normalizedKelasStr = finalKelasStr.replaceAll("(?i)\\bRPL\\b", "PPLG").trim();
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
        return kelas;
    }

    private String syncStudentRow(ParsedRow row, Map<String, List<Siswa>> nisMap, Map<String, List<Siswa>> emailMap, Map<String, List<Siswa>> nameMap) {
        Kelas kelas = getOrCreateKelas(row.kelasStr);

        List<Siswa> targets = null;
        if (row.email != null && !row.email.isEmpty() && emailMap != null) {
            targets = emailMap.get(row.email.toLowerCase());
        }
        if ((targets == null || targets.isEmpty()) && row.nis != null && !row.nis.isEmpty() && nisMap != null) {
            targets = nisMap.get(row.nis.toLowerCase());
        }
        if ((targets == null || targets.isEmpty()) && row.nama != null && !row.nama.isEmpty() && nameMap != null) {
            targets = nameMap.get(row.nama.toLowerCase());
        }

        // 1. Jika Siswa sudah ada di database
        if (targets != null && !targets.isEmpty()) {
            for (Siswa s : targets) {
                Siswa attached = siswaRepository.findById(s.getId()).orElse(s);
                attached.setKelas(kelas);
                if (row.nis != null && !row.nis.isEmpty()) {
                    attached.setNisn(row.nis);
                }
                if (row.nama != null && !row.nama.isEmpty()) {
                    attached.setNamaLengkap(row.nama);
                }
                if (attached.getUser() != null) {
                    Users u = attached.getUser();
                    if (row.nama != null && !row.nama.isEmpty()) u.setNamaLengkap(row.nama);
                    if (row.username != null && !row.username.isEmpty()) u.setUsername(row.username);
                    if (row.email != null && !row.email.isEmpty()) u.setEmail(row.email);
                    if (row.password != null && !row.password.isEmpty()) {
                        u.setPasswordHash(passwordEncoder.encode(row.password));
                    }
                    userRepository.save(u);
                }
                siswaRepository.save(attached);
            }
            String displayLabel = (row.nama != null && !row.nama.isEmpty()) ? row.nama : ("NIS " + row.nis);
            String pwdNote = (row.password != null && !row.password.isEmpty()) ? " [Password Diperbarui]" : "";
            return "[OK] Berhasil disinkron: " + displayLabel + (row.nis != null && !row.nis.isEmpty() ? (" (" + row.nis + ")") : "") + " -> Kelas " + kelas.getNamaKelas() + pwdNote;
        }

        // 2. Siswa belum terdaftar, cek apakah akun Users sudah ada
        Users existingUser = null;
        if (row.email != null && !row.email.isEmpty()) {
            existingUser = userRepository.findByEmail(row.email).orElse(null);
        }
        if (existingUser == null && row.username != null && !row.username.isEmpty()) {
            existingUser = userRepository.findByUsername(row.username).orElse(null);
        }

        if (existingUser != null) {
            if (row.nama != null && !row.nama.isEmpty()) existingUser.setNamaLengkap(row.nama);
            if (row.username != null && !row.username.isEmpty()) existingUser.setUsername(row.username);
            if (row.email != null && !row.email.isEmpty()) existingUser.setEmail(row.email);
            if (row.password != null && !row.password.isEmpty()) {
                existingUser.setPasswordHash(passwordEncoder.encode(row.password));
            }
            existingUser = userRepository.save(existingUser);

            final Users finalU = existingUser;
            Siswa s = siswaRepository.findByUserId(existingUser.getId()).orElseGet(() -> {
                Siswa ns = new Siswa();
                ns.setUser(finalU);
                return ns;
            });
            s.setKelas(kelas);
            s.setNamaLengkap((row.nama != null && !row.nama.isEmpty()) ? row.nama : finalU.getNamaLengkap());
            s.setNisn((row.nis != null && !row.nis.isEmpty()) ? row.nis : finalU.getUsername());
            s = siswaRepository.save(s);

            if (nisMap != null && s.getNisn() != null) nisMap.computeIfAbsent(s.getNisn().toLowerCase(), k -> new ArrayList<>()).add(s);
            if (emailMap != null && finalU.getEmail() != null) emailMap.computeIfAbsent(finalU.getEmail().toLowerCase(), k -> new ArrayList<>()).add(s);
            if (nameMap != null && s.getNamaLengkap() != null) nameMap.computeIfAbsent(s.getNamaLengkap().toLowerCase(), k -> new ArrayList<>()).add(s);

            String pwdNote = (row.password != null && !row.password.isEmpty()) ? " [Password Diperbarui]" : "";
            return "[OK] Akun terhubung: " + s.getNamaLengkap() + " (" + s.getNisn() + ") -> Kelas " + kelas.getNamaKelas() + pwdNote;
        }

        // 3. Akun Users dan Siswa keduanya belum ada -> Buat baru otomatis
        Users newUser = new Users();
        String uname = (row.username != null && !row.username.isEmpty()) ? row.username :
                ((row.email != null && row.email.contains("@")) ? row.email.split("@")[0] :
                ((row.nama != null) ? row.nama.replaceAll("\s+", "").toLowerCase() : "user" + System.currentTimeMillis()));
        newUser.setUsername(uname);
        newUser.setEmail((row.email != null && !row.email.isEmpty()) ? row.email : (uname + "@smk.baktinusantara666.sch.id"));
        newUser.setNamaLengkap((row.nama != null && !row.nama.isEmpty()) ? row.nama : uname);
        newUser.setRole("SISWA");
        newUser.setIsActive(true);
        String rawPwd = (row.password != null && !row.password.isEmpty()) ? row.password : uname;
        newUser.setPasswordHash(passwordEncoder.encode(rawPwd));
        newUser = userRepository.save(newUser);

        Siswa newSiswa = new Siswa();
        newSiswa.setUser(newUser);
        newSiswa.setNisn((row.nis != null && !row.nis.isEmpty()) ? row.nis : newUser.getUsername());
        newSiswa.setNamaLengkap(newUser.getNamaLengkap());
        newSiswa.setKelas(kelas);
        newSiswa = siswaRepository.save(newSiswa);

        if (nisMap != null && newSiswa.getNisn() != null) nisMap.computeIfAbsent(newSiswa.getNisn().toLowerCase(), k -> new ArrayList<>()).add(newSiswa);
        if (emailMap != null && newUser.getEmail() != null) emailMap.computeIfAbsent(newUser.getEmail().toLowerCase(), k -> new ArrayList<>()).add(newSiswa);
        if (nameMap != null && newSiswa.getNamaLengkap() != null) nameMap.computeIfAbsent(newSiswa.getNamaLengkap().toLowerCase(), k -> new ArrayList<>()).add(newSiswa);

        return "[OK] Akun baru dibuat & disinkron: " + newSiswa.getNamaLengkap() + " (" + newSiswa.getNisn() + ") -> Kelas " + kelas.getNamaKelas() + " [Password Baru]";
    }
}
