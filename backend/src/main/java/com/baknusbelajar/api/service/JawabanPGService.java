package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.exam.JawabanPGDTO;
import com.baknusbelajar.api.entity.JawabanPG;
import com.baknusbelajar.api.entity.Siswa;
import com.baknusbelajar.api.entity.SoalPG;
import com.baknusbelajar.api.repository.JawabanPGRepository;
import com.baknusbelajar.api.repository.SiswaRepository;
import com.baknusbelajar.api.repository.SoalPGRepository;
import com.baknusbelajar.api.repository.SiswaUjianStatusRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class JawabanPGService {

    private final JawabanPGRepository jawabanPGRepository;
    private final SoalPGRepository soalPGRepository;
    private final SiswaRepository siswaRepository;
    private final SiswaUjianStatusRepository siswaUjianStatusRepository;
    private final com.baknusbelajar.api.repository.UserRepository userRepository;

    private com.baknusbelajar.api.entity.Siswa createSimulationSiswa(Long userId) {
        return siswaRepository.findByUserId(userId).orElseGet(() -> {
            var user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found with id: " + userId));
            com.baknusbelajar.api.entity.Siswa newSiswa = new com.baknusbelajar.api.entity.Siswa();
            newSiswa.setUser(user);
            newSiswa.setNisn("ADMIN-" + user.getId());
            String name = user.getNamaLengkap() != null && !user.getNamaLengkap().trim().isEmpty()
                    ? user.getNamaLengkap().trim()
                    : user.getUsername();
            if (!name.toLowerCase().contains("admin")) {
                name += " (Admin)";
            }
            newSiswa.setNamaLengkap(name);
            return siswaRepository.save(newSiswa);
        });
    }

    public List<JawabanPGDTO> getJawabanBySiswaAndUjian(Long siswaId, Long ujianId) {
        Long resolvedSiswaId = siswaId;
        var sOpt = siswaRepository.findById(siswaId).or(() -> siswaRepository.findByUserId(siswaId));
        if (sOpt.isPresent()) {
            resolvedSiswaId = sOpt.get().getId();
        }

        List<JawabanPGDTO> list = jawabanPGRepository.findBySiswaIdAndSoalPG_UjianMapel_Id(resolvedSiswaId, ujianId).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());

        siswaUjianStatusRepository.findBySiswaIdAndUjianMapelId(resolvedSiswaId, ujianId).ifPresent(status -> {
            list.forEach(dto -> {
                dto.setWaktuMulaiUjian(status.getWaktuMulaiSiswa());
                dto.setWaktuSelesaiUjian(status.getWaktuSelesai());
                dto.setStatusSelesaiUjian(status.getStatusSelesai());
            });
        });

        return list;
    }

    public List<JawabanPGDTO> getJawabanByUjian(Long ujianId) {
        List<JawabanPGDTO> responses = jawabanPGRepository.findBySoalPG_UjianMapel_Id(ujianId).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());

        responses.forEach(dto -> {
            if (dto.getSiswaId() != null) {
                siswaUjianStatusRepository.findBySiswaIdAndUjianMapelId(dto.getSiswaId(), ujianId)
                        .ifPresent(status -> {
                            dto.setWaktuMulaiUjian(status.getWaktuMulaiSiswa());
                            dto.setWaktuSelesaiUjian(status.getWaktuSelesai());
                            dto.setStatusSelesaiUjian(status.getStatusSelesai());
                        });
            }
        });

        return responses;
    }

    @Transactional
    public JawabanPGDTO submitJawaban(JawabanPGDTO dto, org.springframework.security.core.Authentication authentication) {
        Long targetSoalId = dto.getSoalPGId() != null ? dto.getSoalPGId() : dto.getSoalId();
        if (targetSoalId == null) {
            throw new RuntimeException("Soal ID tidak boleh kosong");
        }
        String targetJawaban = dto.getJawaban() != null ? dto.getJawaban() : dto.getJawabanDipilih();

        SoalPG soal = soalPGRepository.findById(targetSoalId)
                .orElseThrow(() -> new RuntimeException("Soal PG not found (ID: " + targetSoalId + ")"));

        // Resolusi Siswa otomatis & aman (Mendukung siswa nyata maupun simulasi Admin):
        Siswa siswa = null;
        if (authentication != null && authentication.getPrincipal() instanceof com.baknusbelajar.api.security.CustomUserDetails userDetails) {
            siswa = siswaRepository.findByUserId(userDetails.getId())
                    .or(() -> siswaRepository.findById(userDetails.getId()))
                    .orElse(null);
            if (siswa == null) {
                siswa = createSimulationSiswa(userDetails.getId());
            }
        }
        if (siswa == null && dto.getSiswaId() != null) {
            siswa = siswaRepository.findById(dto.getSiswaId())
                    .or(() -> siswaRepository.findByUserId(dto.getSiswaId()))
                    .orElse(null);
            if (siswa == null) {
                siswa = createSimulationSiswa(dto.getSiswaId());
            }
        }
        if (siswa == null) {
            throw new RuntimeException("Siswa tidak ditemukan untuk pengerjaan soal PG ID: " + targetSoalId);
        }

        JawabanPG entity = jawabanPGRepository.findBySiswaIdAndSoalPGId(siswa.getId(), targetSoalId)
                .orElse(new JawabanPG());

        if (soal.getTipeSoal() != null && "PG_KOMPLEKS".equalsIgnoreCase(soal.getTipeSoal())) {
            Set<String> keys = extractOptionKeys(soal, targetJawaban);
            if (keys.size() > 3) {
                targetJawaban = keys.stream().limit(3).collect(Collectors.joining(","));
            }
        }

        entity.setSoalPG(soal);
        entity.setSiswa(siswa);
        entity.setJawaban(targetJawaban);
        if (dto.getRaguRagu() != null) {
            entity.setRaguRagu(dto.getRaguRagu());
        }

        // Automatic Scoring logic for all 3 types:
        // 1. PG_BIASA (1 kunci benar)
        // 2. PG_KOMPLEKS (multi opsi benar, misal 2 opsi)
        // 3. BENAR_SALAH (pilihan Benar / Salah)
        ScoringResult result = calculateScore(soal, targetJawaban);
        entity.setSkor(result.skor);
        entity.setIsCorrect(result.isCorrect);

        return mapToDTO(jawabanPGRepository.save(entity));
    }

    @Transactional
    public void evaluateAndEnsureScoresForUjianAndSiswa(Long ujianId, Long siswaId) {
        List<SoalPG> soalList = soalPGRepository.findByUjianMapelId(ujianId);
        if (soalList.isEmpty()) return;

        Siswa siswa = siswaRepository.findById(siswaId).orElse(null);
        if (siswa == null) return;

        for (SoalPG soal : soalList) {
            Optional<JawabanPG> existingOpt = jawabanPGRepository.findBySiswaIdAndSoalPGId(siswaId, soal.getId());
            if (existingOpt.isPresent()) {
                JawabanPG existing = existingOpt.get();
                ScoringResult result = calculateScore(soal, existing.getJawaban());
                existing.setSkor(result.skor);
                existing.setIsCorrect(result.isCorrect);
                jawabanPGRepository.save(existing);
            } else {
                // Buat jawaban kosong dengan skor 0
                JawabanPG emptyAnswer = new JawabanPG();
                emptyAnswer.setSoalPG(soal);
                emptyAnswer.setSiswa(siswa);
                emptyAnswer.setJawaban("");
                emptyAnswer.setRaguRagu(false);
                emptyAnswer.setSkor(0.0);
                emptyAnswer.setIsCorrect(false);
                jawabanPGRepository.save(emptyAnswer);
            }
        }
        log.info("Auto-score PG completed for Ujian ID: {}, Siswa ID: {}", ujianId, siswaId);
    }

    @Transactional
    public void recalculateAllScoresForUjian(Long ujianId) {
        List<SoalPG> soalList = soalPGRepository.findByUjianMapelId(ujianId);
        List<JawabanPG> jawabanList = jawabanPGRepository.findBySoalPG_UjianMapel_Id(ujianId);
        Map<Long, SoalPG> soalMap = soalList.stream().collect(Collectors.toMap(SoalPG::getId, s -> s));

        for (JawabanPG j : jawabanList) {
            SoalPG soal = soalMap.get(j.getSoalPG().getId());
            if (soal != null) {
                ScoringResult res = calculateScore(soal, j.getJawaban());
                j.setSkor(res.skor);
                j.setIsCorrect(res.isCorrect);
            }
        }
        jawabanPGRepository.saveAll(jawabanList);
        log.info("Recalculated {} PG answers for Ujian ID: {}", jawabanList.size(), ujianId);
    }

    @Transactional
    public JawabanPGDTO updateSkor(Long id, Double skor) {
        JawabanPG entity = jawabanPGRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Jawaban PG not found (ID: " + id + ")"));
        entity.setSkor(skor);
        if (entity.getSoalPG() != null && entity.getSoalPG().getBobotNilai() != null) {
            entity.setIsCorrect(skor >= entity.getSoalPG().getBobotNilai());
        }
        return mapToDTO(jawabanPGRepository.save(entity));
    }

    public static class ScoringResult {
        public double skor;
        public boolean isCorrect;
        public ScoringResult(double skor, boolean isCorrect) {
            this.skor = skor;
            this.isCorrect = isCorrect;
        }
    }

        private String cleanHtml(String text) {
        if (text == null) return "";
        return text.replaceAll("<[^>]*>", "").replace("&nbsp;", " ").trim();
    }

    private Boolean resolveTrueFalse(String val) {
        if (val == null) return null;
        String v = cleanHtml(val).trim().toUpperCase();
        if (v.equals("A") || v.equals("BENAR") || v.equals("TRUE") || v.equals("1") || v.equals("YA") || v.equals("YES")) {
            return true;
        }
        if (v.equals("B") || v.equals("SALAH") || v.equals("FALSE") || v.equals("0") || v.equals("TIDAK") || v.equals("NO")) {
            return false;
        }
        return null;
    }

    private String normalizeOptionLetter(SoalPG soal, String input) {
        if (input == null) return "";
        String clean = cleanHtml(input).trim().toUpperCase();
        if (clean.isEmpty()) return "";

        // Direct letter match: "A", "B", "C", "D", "E"
        if (clean.matches("^[A-E]$")) {
            return clean;
        }

        // Match "A.", "A)", "(A)"
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^\\(?([A-E])[\\.\\)]?").matcher(clean);
        if (m.find()) {
            return m.group(1);
        }

        // Match against option texts
        String textA = cleanHtml(soal.getPilihanA()).toUpperCase();
        String textB = cleanHtml(soal.getPilihanB()).toUpperCase();
        String textC = cleanHtml(soal.getPilihanC()).toUpperCase();
        String textD = cleanHtml(soal.getPilihanD()).toUpperCase();
        String textE = cleanHtml(soal.getPilihanE()).toUpperCase();

        if (!textA.isEmpty() && (clean.equals(textA) || textA.equals(clean))) return "A";
        if (!textB.isEmpty() && (clean.equals(textB) || textB.equals(clean))) return "B";
        if (!textC.isEmpty() && (clean.equals(textC) || textC.equals(clean))) return "C";
        if (!textD.isEmpty() && (clean.equals(textD) || textD.equals(clean))) return "D";
        if (!textE.isEmpty() && (clean.equals(textE) || textE.equals(clean))) return "E";

        return clean;
    }

    public Set<String> extractOptionKeys(SoalPG soal, String raw) {
        if (raw == null || raw.trim().isEmpty()) return Collections.emptySet();
        String clean = cleanHtml(raw).trim().toUpperCase();
        Set<String> result = new LinkedHashSet<>();

        String[] parts = clean.split("[,;\\s]+");
        for (String p : parts) {
            p = p.trim();
            if (p.isEmpty()) continue;
            // Token gabungan huruf opsi seperti "ABC" atau "AB"
            if (p.matches("^[A-E]{2,5}$")) {
                for (char c : p.toCharArray()) {
                    result.add(String.valueOf(c));
                }
            } else {
                String norm = normalizeOptionLetter(soal, p);
                if (!norm.isEmpty()) {
                    result.add(norm);
                }
            }
        }
        return result;
    }

    @Transactional
    public void reevaluateAllJawabanForSoal(SoalPG soal) {
        List<JawabanPG> list = jawabanPGRepository.findBySoalPGId(soal.getId());
        for (JawabanPG j : list) {
            ScoringResult res = calculateScore(soal, j.getJawaban());
            j.setSkor(res.skor);
            j.setIsCorrect(res.isCorrect);
            jawabanPGRepository.save(j);
        }
        log.info("Re-evaluated {} student answers for Soal ID: {}", list.size(), soal.getId());
    }

    public Boolean parseBSToken(String token) {
        if (token == null) return null;
        String t = cleanHtml(token).trim().toUpperCase();
        if (t.isEmpty() || t.equals("-")) return null;

        // Mendukung format berlabel seperti "1:B", "A:B", "1. B", "1=B", "A=B", "1-B"
        if (t.contains(":") || t.contains("=") || t.contains(".")) {
            String[] parts = t.split("[:=.]");
            if (parts.length > 1) {
                t = parts[parts.length - 1].trim();
            }
        }

        // Benar: "B", "BENAR", "TRUE", "T", "1", "YA", "YES"
        if (t.equals("B") || t.startsWith("BENAR") || t.equals("TRUE") || t.equals("T") || t.equals("1") || t.equals("YA") || t.equals("YES")) {
            return true;
        }

        // Salah: "S", "SALAH", "FALSE", "F", "0", "TIDAK", "NO"
        if (t.equals("S") || t.startsWith("SALAH") || t.equals("FALSE") || t.equals("F") || t.equals("0") || t.equals("TIDAK") || t.equals("NO")) {
            return false;
        }

        return null;
    }

    private boolean isBSMajemukPattern(String tipe, String rawKunci, String rawJawaban) {
        if ("BS_MAJEMUK".equalsIgnoreCase(tipe)) {
            return true;
        }
        if ("PG_KOMPLEKS".equalsIgnoreCase(tipe) || "PG_BIASA".equalsIgnoreCase(tipe) || "BENAR_SALAH".equalsIgnoreCase(tipe)) {
            return false;
        }
        String upKunci = rawKunci != null ? rawKunci.toUpperCase() : "";
        if (upKunci.contains(":B") || upKunci.contains(":S") || upKunci.contains("=B") || upKunci.contains("=S")) {
            return true;
        }
        // Jika kunci terdiri dari rangkaian token B/S (minimal 2 butir) dipisah koma/titik-koma/spasi
        String[] kParts = upKunci.split("[,;\\s]+");
        if (kParts.length >= 2) {
            boolean allBS = true;
            for (String p : kParts) {
                if (parseBSToken(p) == null) {
                    allBS = false;
                    break;
                }
            }
            if (allBS) return true;
        }
        // Fallback: Jika jawaban siswa terdiri dari rangkaian token B/S (misal "B,S,B,B")
        String upJawaban = rawJawaban != null ? rawJawaban.toUpperCase() : "";
        String[] aParts = upJawaban.split("[,;\\s]+");
        if (aParts.length >= 2) {
            boolean allAnsBS = true;
            for (String p : aParts) {
                if (parseBSToken(p) == null) {
                    allAnsBS = false;
                    break;
                }
            }
            if (allAnsBS && (rawKunci.contains(",") || rawKunci.contains(";"))) {
                return true;
            }
        }
        return false;
    }

    public ScoringResult calculateScore(SoalPG soal, String jawabanSiswa) {
        if (jawabanSiswa == null || jawabanSiswa.trim().isEmpty()) {
            return new ScoringResult(0.0, false);
        }

        String rawKunci = soal.getKunciJawaban() != null ? soal.getKunciJawaban().trim() : "";
        String rawJawaban = jawabanSiswa.trim();
        double bobot = soal.getBobotNilai() != null ? soal.getBobotNilai() : 1.0;

        String tipe = soal.getTipeSoal();
        String cleanPilA = cleanHtml(soal.getPilihanA()).toLowerCase();
        String cleanPilB = cleanHtml(soal.getPilihanB()).toLowerCase();

        boolean looksLikeBSMajemuk = isBSMajemukPattern(tipe, rawKunci, rawJawaban);

        boolean looksLikeBS = !looksLikeBSMajemuk && ("BENAR_SALAH".equalsIgnoreCase(tipe) ||
                ((cleanPilA.equals("benar") || cleanPilA.equals("true")) &&
                 (cleanPilB.equals("salah") || cleanPilB.equals("false"))));

        boolean looksLikeKompleks = !looksLikeBSMajemuk && ("PG_KOMPLEKS".equalsIgnoreCase(tipe) ||
                (!looksLikeBS && (rawKunci.contains(",") || rawKunci.contains(";") || rawJawaban.contains(",") || rawJawaban.contains(";") || rawKunci.matches("(?i).*[A-E]{2,}.*"))));

        if (looksLikeBSMajemuk) {
            String[] keyParts = rawKunci.split("[,;]+");
            String[] ansParts = rawJawaban.split("[,;]+");

            List<Boolean> keyBools = new ArrayList<>();
            for (String k : keyParts) {
                Boolean b = parseBSToken(k);
                if (b != null) {
                    keyBools.add(b);
                }
            }

            // Hitung jumlah butir pernyataan aktif dari soal (A sampai E yang terdefinisi)
            int activeStatements = 0;
            if (soal.getPilihanA() != null && !"-".equals(soal.getPilihanA().trim()) && !soal.getPilihanA().trim().isEmpty()) activeStatements++;
            if (soal.getPilihanB() != null && !"-".equals(soal.getPilihanB().trim()) && !soal.getPilihanB().trim().isEmpty()) activeStatements++;
            if (soal.getPilihanC() != null && !"-".equals(soal.getPilihanC().trim()) && !soal.getPilihanC().trim().isEmpty()) activeStatements++;
            if (soal.getPilihanD() != null && !"-".equals(soal.getPilihanD().trim()) && !soal.getPilihanD().trim().isEmpty()) activeStatements++;
            if (soal.getPilihanE() != null && !"-".equals(soal.getPilihanE().trim()) && !soal.getPilihanE().trim().isEmpty()) activeStatements++;

            int totalItems = keyBools.size();
            if (activeStatements >= 2) {
                totalItems = Math.max(totalItems, activeStatements);
            }
            if (totalItems == 0) {
                totalItems = Math.max(keyParts.length, ansParts.length);
            }
            if (totalItems == 0) {
                return new ScoringResult(0.0, false);
            }

            int matchCount = 0;
            for (int i = 0; i < totalItems; i++) {
                Boolean kB = (i < keyBools.size()) ? keyBools.get(i) : null;
                Boolean aB = (i < ansParts.length) ? parseBSToken(ansParts[i]) : null;

                if (kB != null && aB != null && kB.equals(aB)) {
                    matchCount++;
                }
            }

            double partial = (double) matchCount / totalItems * bobot;
            double rounded = Math.round(partial * 100.0) / 100.0;
            boolean isFullMatch = (matchCount == totalItems);

            log.info("Scoring BS_MAJEMUK [Soal {}]: Match={}/{} (Bobot={}) -> Skor={}",
                    soal.getId(), matchCount, totalItems, bobot, rounded);

            return new ScoringResult(rounded, isFullMatch);
        }

        if (looksLikeBS) {
            Boolean studentTF = resolveTrueFalse(rawJawaban);
            Boolean keyTF = resolveTrueFalse(rawKunci);

            boolean match = false;
            if (studentTF != null && keyTF != null) {
                match = studentTF.equals(keyTF);
            } else {
                String normS = normalizeOptionLetter(soal, rawJawaban);
                String normK = normalizeOptionLetter(soal, rawKunci);
                match = normS.equalsIgnoreCase(normK);
            }
            log.info("Scoring BENAR_SALAH [Soal {}]: Siswa='{}' ({}), Kunci='{}' ({}) -> Match={}",
                    soal.getId(), rawJawaban, studentTF, rawKunci, keyTF, match);
            return new ScoringResult(match ? bobot : 0.0, match);
        }

        if (looksLikeKompleks) {
            Set<String> setKunci = extractOptionKeys(soal, rawKunci);
            Set<String> setJawaban = extractOptionKeys(soal, rawJawaban);

            if (setKunci.isEmpty() || setJawaban.isEmpty()) {
                return new ScoringResult(0.0, false);
            }

            long correctSelected = setJawaban.stream().filter(setKunci::contains).count();
            long wrongSelected = setJawaban.stream().filter(j -> !setKunci.contains(j)).count();

            if (correctSelected == setKunci.size() && wrongSelected == 0) {
                log.info("Scoring PG_KOMPLEKS [Soal {}]: Full Match (Bobot {})", soal.getId(), bobot);
                return new ScoringResult(bobot, true);
            } else if (correctSelected > 0) {
                // Proporsional murni per kunci benar (misal bobot 7.5 dgn 3 kunci: 1 benar = 2.5, 2 benar = 5.0, 3 benar = 7.5)
                double partial = ((double) correctSelected / setKunci.size()) * bobot;
                double rounded = Math.round(partial * 100.0) / 100.0;
                boolean isFull = (correctSelected == setKunci.size() && wrongSelected == 0) || rounded >= bobot;
                log.info("Scoring PG_KOMPLEKS [Soal {}]: Match {}/{} correct (Wrong={}, Bobot={}) -> {}",
                        soal.getId(), correctSelected, setKunci.size(), wrongSelected, bobot, rounded);
                return new ScoringResult(rounded, isFull);
            } else {
                log.info("Scoring PG_KOMPLEKS [Soal {}]: No correct answers (Wrong={})", soal.getId(), wrongSelected);
                return new ScoringResult(0.0, false);
            }
        }

        // PG_BIASA
        String normS = normalizeOptionLetter(soal, rawJawaban);
        String normK = normalizeOptionLetter(soal, rawKunci);
        boolean match = normS.equalsIgnoreCase(normK) ||
                        cleanHtml(rawJawaban).equalsIgnoreCase(cleanHtml(rawKunci));

        log.info("Scoring PG_BIASA [Soal {}]: Siswa='{}' (Norm: {}), Kunci='{}' (Norm: {}) -> Match={}",
                soal.getId(), rawJawaban, normS, rawKunci, normK, match);

        return new ScoringResult(match ? bobot : 0.0, match);
    }

    private JawabanPGDTO mapToDTO(JawabanPG j) {
        JawabanPGDTO dto = new JawabanPGDTO();
        dto.setId(j.getId());
        if (j.getSoalPG() != null) {
            dto.setSoalPGId(j.getSoalPG().getId());
            dto.setSoalId(j.getSoalPG().getId());
            dto.setKunciJawaban(j.getSoalPG().getKunciJawaban());
            dto.setBobotNilai(j.getSoalPG().getBobotNilai());
            dto.setTipeSoal(j.getSoalPG().getTipeSoal());
        }
        if (j.getSiswa() != null) {
            dto.setSiswaId(j.getSiswa().getId());
            dto.setNamaSiswa(j.getSiswa().getNamaLengkap());

            String email = j.getSiswa().getUser() != null ? j.getSiswa().getUser().getEmail() : null;
            if (email != null && email.contains("@")) {
                dto.setNisn(email.substring(0, email.indexOf("@")));
            } else {
                dto.setNisn(j.getSiswa().getNisn());
            }

            if (j.getSiswa().getKelas() != null) {
                dto.setNamaKelas(j.getSiswa().getKelas().getNamaKelas());
            } else {
                dto.setNamaKelas("Tanpa Kelas");
            }
        }
        dto.setJawaban(j.getJawaban());
        dto.setJawabanDipilih(j.getJawaban());
        dto.setRaguRagu(j.getRaguRagu());
        dto.setSkor(j.getSkor());
        dto.setIsCorrect(j.getIsCorrect());
        return dto;
    }
}
