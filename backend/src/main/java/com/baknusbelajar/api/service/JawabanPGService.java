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

    public List<JawabanPGDTO> getJawabanBySiswaAndUjian(Long siswaId, Long ujianId) {
        List<JawabanPGDTO> list = jawabanPGRepository.findBySiswaIdAndSoalPG_UjianMapel_Id(siswaId, ujianId).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());

        siswaUjianStatusRepository.findBySiswaIdAndUjianMapelId(siswaId, ujianId).ifPresent(status -> {
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
    public JawabanPGDTO submitJawaban(JawabanPGDTO dto) {
        Long targetSoalId = dto.getSoalPGId() != null ? dto.getSoalPGId() : dto.getSoalId();
        if (targetSoalId == null) {
            throw new RuntimeException("Soal ID tidak boleh kosong");
        }
        String targetJawaban = dto.getJawaban() != null ? dto.getJawaban() : dto.getJawabanDipilih();

        SoalPG soal = soalPGRepository.findById(targetSoalId)
                .orElseThrow(() -> new RuntimeException("Soal PG not found (ID: " + targetSoalId + ")"));
        Siswa siswa = siswaRepository.findById(dto.getSiswaId())
                .orElseThrow(() -> new RuntimeException("Siswa not found (ID: " + dto.getSiswaId() + ")"));

        JawabanPG entity = jawabanPGRepository.findBySiswaIdAndSoalPGId(dto.getSiswaId(), targetSoalId)
                .orElse(new JawabanPG());

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

        boolean looksLikeBS = "BENAR_SALAH".equalsIgnoreCase(tipe) ||
                ((cleanPilA.equals("benar") || cleanPilA.equals("true")) &&
                 (cleanPilB.equals("salah") || cleanPilB.equals("false")));

        boolean looksLikeKompleks = "PG_KOMPLEKS".equalsIgnoreCase(tipe) ||
                (!looksLikeBS && (rawKunci.contains(",") || rawJawaban.contains(",")));

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
            // Split keys and answers into sets, normalizing to option letters (A, B, C, D, E)
            Set<String> setKunci = Arrays.stream(rawKunci.split("[,;\\s]+"))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .map(s -> normalizeOptionLetter(soal, s))
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toSet());

            Set<String> setJawaban = Arrays.stream(rawJawaban.split("[,;\\s]+"))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .map(s -> normalizeOptionLetter(soal, s))
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toSet());

            if (setKunci.isEmpty() || setJawaban.isEmpty()) {
                return new ScoringResult(0.0, false);
            }

            long correctSelected = setJawaban.stream().filter(setKunci::contains).count();
            long wrongSelected = setJawaban.stream().filter(j -> !setKunci.contains(j)).count();

            if (correctSelected == setKunci.size() && wrongSelected == 0) {
                log.info("Scoring PG_KOMPLEKS [Soal {}]: Full Match (Bobot {})", soal.getId(), bobot);
                return new ScoringResult(bobot, true);
            } else if (correctSelected > 0 && wrongSelected == 0) {
                double partial = (double) correctSelected / setKunci.size() * bobot;
                double rounded = Math.round(partial * 100.0) / 100.0;
                log.info("Scoring PG_KOMPLEKS [Soal {}]: Partial Match ({}/{}) -> {}", soal.getId(), correctSelected, setKunci.size(), rounded);
                return new ScoringResult(rounded, false);
            } else {
                log.info("Scoring PG_KOMPLEKS [Soal {}]: Wrong answer selected (Wrong={})", soal.getId(), wrongSelected);
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
