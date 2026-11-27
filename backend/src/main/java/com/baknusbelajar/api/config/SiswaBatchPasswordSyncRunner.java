package com.baknusbelajar.api.config;

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
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Slf4j
@Component
@Order(2)
@RequiredArgsConstructor
public class SiswaBatchPasswordSyncRunner implements CommandLineRunner {

    private final UserRepository userRepository;
    private final SiswaRepository siswaRepository;
    private final KelasRepository kelasRepository;
    private final JurusanRepository jurusanRepository;
    private final PasswordEncoder passwordEncoder;
    private final PlatformTransactionManager transactionManager;

    @Override
    public void run(String... args) {
        ClassPathResource resource = new ClassPathResource("data/sync_xii_20261127.csv");
        if (!resource.exists()) {
            return;
        }

        List<String[]> rows = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            boolean header = true;
            while ((line = br.readLine()) != null) {
                if (line.trim().isEmpty()) continue;
                if (header) {
                    header = false;
                    if (line.toLowerCase().contains("nis") && line.toLowerCase().contains("password")) {
                        continue;
                    }
                }
                String[] parts = line.split(",", -1);
                if (parts.length < 5) continue;
                String nis = parts[0].trim();
                String nama = parts[1].trim();
                String kelas = parts[2].trim();
                String username = parts[3].trim();
                String password = parts[4].trim();
                String email = parts.length > 5 ? parts[5].trim() : "";
                if (!nis.isEmpty() && !password.isEmpty()) {
                    rows.add(new String[]{nis, nama, kelas, username, password, email});
                }
            }
        } catch (Exception e) {
            log.error("[SiswaBatchSync] Gagal membaca CSV batch siswa: {}", e.getMessage(), e);
            return;
        }

        if (rows.isEmpty()) return;

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> processAndVerify(rows));
    }

    private void processAndVerify(List<String[]> rows) {
        Map<String, List<Siswa>> nisMap = new HashMap<>();
        Map<String, List<Siswa>> nameMap = new HashMap<>();

        for (Siswa s : siswaRepository.findAll()) {
            if (s.getNisn() != null && !s.getNisn().trim().isEmpty()) {
                nisMap.computeIfAbsent(s.getNisn().trim().toLowerCase(), k -> new ArrayList<>()).add(s);
            }
            if (s.getNamaLengkap() != null && !s.getNamaLengkap().trim().isEmpty()) {
                nameMap.computeIfAbsent(s.getNamaLengkap().trim().toLowerCase(), k -> new ArrayList<>()).add(s);
            }
        }

        int total = 0;
        int created = 0;
        int passwordUpdated = 0;
        int kelasUpdated = 0;
        int activated = 0;
        int verifiedOk = 0;
        int failed = 0;

        for (String[] row : rows) {
            total++;
            String nis = row[0];
            String nama = row[1];
            String kelasStr = row[2];
            String username = row[3];
            String rawPassword = row[4];
            String email = row[5];

            try {
                Kelas targetKelas = getOrCreateKelas(kelasStr);

                List<Siswa> byNis = nisMap.get(nis.toLowerCase());
                List<Siswa> matchedSiswa = new ArrayList<>();
                if (byNis != null && !byNis.isEmpty()) {
                    for (Siswa cand : byNis) {
                        if (cand.getNamaLengkap() != null && cand.getNamaLengkap().trim().equalsIgnoreCase(nama)) {
                            matchedSiswa.add(cand);
                        }
                    }
                }
                if (matchedSiswa.isEmpty() && !nama.isEmpty()) {
                    List<Siswa> byName = nameMap.get(nama.toLowerCase());
                    if (byName != null && !byName.isEmpty()) {
                        matchedSiswa.addAll(byName);
                    }
                }
                if (matchedSiswa.isEmpty() && byNis != null && byNis.size() == 1 && !nis.equals("242518070050")) {
                    matchedSiswa.addAll(byNis);
                }

                Siswa primarySiswa = null;
                if (matchedSiswa != null && !matchedSiswa.isEmpty()) {
                    for (Siswa s : matchedSiswa) {
                        Siswa attached = siswaRepository.findById(s.getId()).orElse(s);
                        if (attached.getKelas() == null || !attached.getKelas().getId().equals(targetKelas.getId())) {
                            attached.setKelas(targetKelas);
                            kelasUpdated++;
                        }
                        if (attached.getNisn() == null || attached.getNisn().trim().isEmpty()) {
                            attached.setNisn(nis);
                        }
                        if (!nama.isEmpty()) {
                            attached.setNamaLengkap(nama);
                        }

                        Users u = attached.getUser();
                        if (u == null) {
                            u = findOrCreateUser(nis, nama, username, email, rawPassword);
                            attached.setUser(u);
                        } else {
                            if (!Boolean.TRUE.equals(u.getIsActive())) {
                                u.setIsActive(true);
                                activated++;
                            }
                            if (u.getRole() == null || u.getRole().trim().isEmpty()) {
                                u.setRole("SISWA");
                            }
                            if (u.getPasswordHash() == null || !passwordEncoder.matches(rawPassword, u.getPasswordHash())) {
                                u.setPasswordHash(passwordEncoder.encode(rawPassword));
                                passwordUpdated++;
                            }
                            u = userRepository.save(u);
                        }
                        primarySiswa = siswaRepository.save(attached);
                    }
                } else {
                    Users u = findOrCreateUser(nis, nama, username, email, rawPassword);
                    if (u.getId() == null) {
                        created++;
                    }
                    List<Siswa> byUser = siswaRepository.findAllByUserId(u.getId());
                    Siswa s = !byUser.isEmpty() ? byUser.get(0) : new Siswa();
                    boolean isNewSiswa = s.getId() == null;
                    s.setUser(u);
                    s.setNisn(nis);
                    s.setNamaLengkap(!nama.isEmpty() ? nama : u.getNamaLengkap());
                    if (s.getKelas() == null || !s.getKelas().getId().equals(targetKelas.getId())) {
                        s.setKelas(targetKelas);
                        if (!isNewSiswa) kelasUpdated++;
                    }
                    primarySiswa = siswaRepository.save(s);
                    if (isNewSiswa) created++;
                }

                // Verifikasi akhir: password cocok, akun aktif, dan kelas sesuai
                boolean ok = primarySiswa != null
                        && primarySiswa.getUser() != null
                        && Boolean.TRUE.equals(primarySiswa.getUser().getIsActive())
                        && primarySiswa.getUser().getPasswordHash() != null
                        && passwordEncoder.matches(rawPassword, primarySiswa.getUser().getPasswordHash())
                        && primarySiswa.getKelas() != null
                        && primarySiswa.getKelas().getNamaKelas().equalsIgnoreCase(targetKelas.getNamaKelas());

                if (ok) {
                    verifiedOk++;
                } else {
                    failed++;
                    log.warn("[SiswaBatchSync] VERIFIKASI GAGAL untuk NIS={} ({})", nis, nama);
                }
            } catch (Exception ex) {
                failed++;
                log.error("[SiswaBatchSync] Error memproses NIS={} ({}): {}", nis, nama, ex.getMessage());
            }
        }

        log.info("[SiswaBatchSync] SELESAI: Total={} | Verified Login & Kelas OK={} | Password Diupdate={} | Kelas Diperbaiki={} | Diaktifkan={} | Baru Dibuat={} | Gagal={}",
                total, verifiedOk, passwordUpdated, kelasUpdated, activated, created, failed);
    }

    private Users findOrCreateUser(String nis, String nama, String username, String email, String rawPassword) {
        String resolvedUsername = !username.isEmpty() ? username : nis;
        String resolvedEmail = !email.isEmpty() ? email : (resolvedUsername + "@smk.baktinusantara666.sch.id");

        Users existing = null;
        if (!email.isEmpty()) {
            List<Users> byEmail = userRepository.findAllByEmailIgnoreCase(email);
            if (!byEmail.isEmpty()) existing = byEmail.get(0);
        }
        if (existing == null) {
            List<Users> byDefaultEmail = userRepository.findAllByEmailIgnoreCase(resolvedEmail);
            if (!byDefaultEmail.isEmpty()) existing = byDefaultEmail.get(0);
        }
        if (existing == null) {
            List<Users> byUname = userRepository.findAllByUsernameIgnoreCase(resolvedUsername);
            if (!byUname.isEmpty()) existing = byUname.get(0);
        }

        if (existing != null && !nama.isEmpty() && existing.getNamaLengkap() != null
                && !existing.getNamaLengkap().trim().equalsIgnoreCase(nama)) {
            // Hindari bentrok akun jika NIS ganda (misal 242518070050)
            String slug = nama.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
            resolvedUsername = slug.isEmpty() ? ("siswa" + System.currentTimeMillis()) : slug;
            resolvedEmail = resolvedUsername + "@smk.baktinusantara666.sch.id";
            List<Users> bySlug = userRepository.findAllByEmailIgnoreCase(resolvedEmail);
            existing = !bySlug.isEmpty() ? bySlug.get(0) : null;
        }

        if (existing != null) {
            existing.setIsActive(true);
            if (existing.getRole() == null || existing.getRole().trim().isEmpty()) {
                existing.setRole("SISWA");
            }
            if (existing.getPasswordHash() == null || !passwordEncoder.matches(rawPassword, existing.getPasswordHash())) {
                existing.setPasswordHash(passwordEncoder.encode(rawPassword));
            }
            return userRepository.save(existing);
        }

        Users newUser = new Users();
        newUser.setUsername(resolvedUsername);
        newUser.setEmail(resolvedEmail);
        newUser.setNamaLengkap(!nama.isEmpty() ? nama : resolvedUsername);
        newUser.setRole("SISWA");
        newUser.setIsActive(true);
        newUser.setPasswordHash(passwordEncoder.encode(rawPassword));
        return userRepository.save(newUser);
    }

    private Kelas getOrCreateKelas(String rawKelasStr) {
        String normalized = rawKelasStr.replaceAll("(?i)\\bRPL\\b", "PPLG").trim();
        List<Kelas> existing = kelasRepository.findAllByNamaKelasIgnoreCase(normalized);
        if (!existing.isEmpty()) {
            return existing.get(0);
        }

        String tingkat = "XII";
        if (normalized.contains(" ")) {
            tingkat = normalized.split(" ")[0];
        } else if (normalized.toUpperCase().startsWith("XI")) {
            tingkat = "XI";
        } else if (normalized.toUpperCase().startsWith("X")) {
            tingkat = "X";
        }

        String jurusanPart = normalized.substring(tingkat.length()).trim();
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

        Kelas k = new Kelas();
        k.setNamaKelas(normalized);
        k.setTingkat(tingkat);
        k.setJurusan(jurusan);
        return kelasRepository.save(k);
    }
}
