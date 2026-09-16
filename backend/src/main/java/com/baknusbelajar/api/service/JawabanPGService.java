package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.exam.JawabanPGDTO;
import com.baknusbelajar.api.entity.JawabanPG;
import com.baknusbelajar.api.entity.Siswa;
import com.baknusbelajar.api.entity.SoalPG;
import com.baknusbelajar.api.repository.JawabanPGRepository;
import com.baknusbelajar.api.repository.SiswaRepository;
import com.baknusbelajar.api.repository.SoalPGRepository;
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

    public List<JawabanPGDTO> getJawabanBySiswaAndUjian(Long siswaId, Long ujianId) {
        return jawabanPGRepository.findBySiswaIdAndSoalPG_UjianMapel_Id(siswaId, ujianId).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    public List<JawabanPGDTO> getJawabanByUjian(Long ujianId) {
        return jawabanPGRepository.findBySoalPG_UjianMapel_Id(ujianId).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public JawabanPGDTO submitJawaban(JawabanPGDTO dto) {
        SoalPG soal = soalPGRepository.findById(dto.getSoalPGId())
                .orElseThrow(() -> new RuntimeException("Soal PG not found (ID: " + dto.getSoalPGId() + ")"));
        Siswa siswa = siswaRepository.findById(dto.getSiswaId())
                .orElseThrow(() -> new RuntimeException("Siswa not found (ID: " + dto.getSiswaId() + ")"));

        JawabanPG entity = jawabanPGRepository.findBySiswaIdAndSoalPGId(dto.getSiswaId(), dto.getSoalPGId())
                .orElse(new JawabanPG());

        entity.setSoalPG(soal);
        entity.setSiswa(siswa);
        entity.setJawaban(dto.getJawaban());
        if (dto.getRaguRagu() != null) {
            entity.setRaguRagu(dto.getRaguRagu());
        }

        // Automatic Scoring logic for all 3 types:
        // 1. PG_BIASA (1 kunci benar)
        // 2. PG_KOMPLEKS (multi opsi benar, misal 2 opsi)
        // 3. BENAR_SALAH (pilihan Benar / Salah)
        ScoringResult result = calculateScore(soal, dto.getJawaban());
        entity.setSkor(result.skor);
        entity.setIsCorrect(result.isCorrect);

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
        String tipe = soal.getTipeSoal() != null ? soal.getTipeSoal() : "PG_BIASA";

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
            return new ScoringResult(match ? bobot : 0.0, match);
        }
    }

    private JawabanPGDTO mapToDTO(JawabanPG j) {
        JawabanPGDTO dto = new JawabanPGDTO();
        dto.setId(j.getId());
        dto.setSoalPGId(j.getSoalPG().getId());
        dto.setSiswaId(j.getSiswa().getId());
        dto.setJawaban(j.getJawaban());
        dto.setRaguRagu(j.getRaguRagu());
        dto.setSkor(j.getSkor());
        dto.setIsCorrect(j.getIsCorrect());
        if (j.getSoalPG() != null) {
            dto.setKunciJawaban(j.getSoalPG().getKunciJawaban());
            dto.setBobotNilai(j.getSoalPG().getBobotNilai());
            dto.setTipeSoal(j.getSoalPG().getTipeSoal());
        }
        return dto;
    }
}
