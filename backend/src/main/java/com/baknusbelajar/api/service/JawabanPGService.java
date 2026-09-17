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

    public ScoringResult calculateScore(SoalPG soal, String jawabanSiswa) {
        if (jawabanSiswa == null || jawabanSiswa.trim().isEmpty()) {
            return new ScoringResult(0.0, false);
        }

        String kunci = soal.getKunciJawaban() != null ? soal.getKunciJawaban().trim().toUpperCase() : "";
        String jawaban = jawabanSiswa.trim().toUpperCase();
        double bobot = soal.getBobotNilai() != null ? soal.getBobotNilai() : 1.0;
        String tipe = soal.getTipeSoal();
        if (tipe == null || tipe.trim().isEmpty() || "PG_BIASA".equalsIgnoreCase(tipe)) {
            if (kunci.contains(",")) {
                tipe = "PG_KOMPLEKS";
            } else if ("Benar".equalsIgnoreCase(soal.getPilihanA()) && "Salah".equalsIgnoreCase(soal.getPilihanB())) {
                tipe = "BENAR_SALAH";
            } else {
                tipe = "PG_BIASA";
            }
        }

        if ("PG_KOMPLEKS".equalsIgnoreCase(tipe)) {
            // Split keys and answers into sets (e.g. "A,C" -> {"A", "C"})
            Set<String> setKunci = Arrays.stream(kunci.split("[,;\\s]+"))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toSet());

            Set<String> setJawaban = Arrays.stream(jawaban.split("[,;\\s]+"))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toSet());

            if (setKunci.isEmpty() || setJawaban.isEmpty()) {
                return new ScoringResult(0.0, false);
            }

            // Hitung jawaban benar yang dipilih
            long correctSelected = setJawaban.stream().filter(setKunci::contains).count();
            long wrongSelected = setJawaban.stream().filter(j -> !setKunci.contains(j)).count();

            if (correctSelected == setKunci.size() && wrongSelected == 0) {
                // Semua tepat 100%
                return new ScoringResult(bobot, true);
            } else if (correctSelected > 0 && wrongSelected == 0) {
                // Skor proporsional jika benar sebagian tanpa jawaban salah
                double partial = (double) correctSelected / setKunci.size() * bobot;
                return new ScoringResult(Math.round(partial * 100.0) / 100.0, false);
            } else {
                return new ScoringResult(0.0, false);
            }
        } else {
            // PG_BIASA & BENAR_SALAH
            boolean match = jawaban.equalsIgnoreCase(kunci);
            if (!match && "BENAR_SALAH".equalsIgnoreCase(tipe)) {
                boolean studentIsBenar = "A".equalsIgnoreCase(jawaban) || "BENAR".equalsIgnoreCase(jawaban) || "TRUE".equalsIgnoreCase(jawaban) || "1".equals(jawaban);
                boolean studentIsSalah = "B".equalsIgnoreCase(jawaban) || "SALAH".equalsIgnoreCase(jawaban) || "FALSE".equalsIgnoreCase(jawaban) || "0".equals(jawaban);
                boolean keyIsBenar = "A".equalsIgnoreCase(kunci) || "BENAR".equalsIgnoreCase(kunci) || "TRUE".equalsIgnoreCase(kunci) || "1".equals(kunci);
                boolean keyIsSalah = "B".equalsIgnoreCase(kunci) || "SALAH".equalsIgnoreCase(kunci) || "FALSE".equalsIgnoreCase(kunci) || "0".equals(kunci);

                match = (studentIsBenar && keyIsBenar) || (studentIsSalah && keyIsSalah);
            }
            return new ScoringResult(match ? bobot : 0.0, match);
        }
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
