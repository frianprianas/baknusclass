package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.exam.SoalPGDTO;
import com.baknusbelajar.api.entity.SoalPG;
import com.baknusbelajar.api.entity.UjianMapel;
import com.baknusbelajar.api.repository.SoalPGRepository;
import com.baknusbelajar.api.repository.UjianMapelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SoalPGService {

    private final SoalPGRepository soalPGRepository;
    private final UjianMapelRepository ujianMapelRepository;
    private final KartuSoalService kartuSoalService;

    @Cacheable(value = "soalPGCache", key = "#ujianId + '-' + #includeKunci")
    public List<SoalPGDTO> getSoalByUjian(Long ujianId, boolean includeKunci) {
        return soalPGRepository.findByUjianMapelId(ujianId).stream().map(s -> {
            SoalPGDTO dto = mapToDTO(s);
            if (!includeKunci)
                dto.setKunciJawaban(null);
            return dto;
        }).collect(Collectors.toList());
    }

    @CacheEvict(value = "soalPGCache", allEntries = true)
    public SoalPGDTO createSoal(SoalPGDTO dto) {
        Long uId = dto.getUjianId() != null ? dto.getUjianId() : dto.getUjianMapelId();
        if (uId == null) {
            throw new IllegalArgumentException("ID Ujian tidak boleh kosong (ujianId / ujianMapelId wajib ada)");
        }
        UjianMapel ujian = ujianMapelRepository.findById(uId)
                .orElseThrow(() -> new RuntimeException("Ujian tidak ditemukan dengan ID: " + uId));

        SoalPG entity = new SoalPG();
        entity.setUjianMapel(ujian);
        entity.setPertanyaan(dto.getPertanyaan());
        entity.setPilihanA(dto.getPilihanA() != null && !dto.getPilihanA().trim().isEmpty() ? dto.getPilihanA() : "Benar");
        entity.setPilihanB(dto.getPilihanB() != null && !dto.getPilihanB().trim().isEmpty() ? dto.getPilihanB() : "Salah");
        entity.setPilihanC(dto.getPilihanC() != null && !dto.getPilihanC().trim().isEmpty() ? dto.getPilihanC() : "-");
        entity.setPilihanD(dto.getPilihanD() != null && !dto.getPilihanD().trim().isEmpty() ? dto.getPilihanD() : "-");
        entity.setPilihanE(dto.getPilihanE() != null && !dto.getPilihanE().trim().isEmpty() ? dto.getPilihanE() : "-");
        entity.setKunciJawaban(dto.getKunciJawaban());
        entity.setBobotNilai(dto.getBobotNilai());
        String tipe = dto.getTipeSoal();
        String kj = dto.getKunciJawaban() != null ? dto.getKunciJawaban().trim() : "";
        if (tipe == null || tipe.isEmpty() || "PG_BIASA".equalsIgnoreCase(tipe)) {
            if ("Benar".equalsIgnoreCase(dto.getPilihanA()) && "Salah".equalsIgnoreCase(dto.getPilihanB())) {
                tipe = "BENAR_SALAH";
            } else if (kj.contains(",") || kj.contains(";") || kj.length() > 1) {
                tipe = "PG_KOMPLEKS";
            }
        }
        entity.setTipeSoal(tipe != null ? tipe : "PG_BIASA");

        SoalPG saved = soalPGRepository.save(entity);
        String fullPertanyaan;
        if ("BENAR_SALAH".equalsIgnoreCase(entity.getTipeSoal())) {
            fullPertanyaan = String.format("%s<br>A. %s<br>B. %s (Format Pernyataan Benar/Salah)",
                    dto.getPertanyaan(), entity.getPilihanA(), entity.getPilihanB());
        } else {
            fullPertanyaan = String.format("%s<br>A. %s<br>B. %s<br>C. %s<br>D. %s<br>E. %s",
                    dto.getPertanyaan(), entity.getPilihanA(), entity.getPilihanB(), entity.getPilihanC(), entity.getPilihanD(),
                    entity.getPilihanE() != null ? entity.getPilihanE() : "-");
        }
        try {
            kartuSoalService.generateAndUploadAutoKartuSoal(ujian, fullPertanyaan, dto.getKunciJawaban(),
                    dto.getBobotNilai(), "PG");
        } catch (Exception e) {
            // Do not fail DB save if drive upload has an issue
        }

        return mapToDTO(saved);
    }

    @CacheEvict(value = "soalPGCache", allEntries = true)
    public void deleteSoal(Long id) {
        soalPGRepository.deleteById(id);
    }

    @CacheEvict(value = "soalPGCache", allEntries = true)
    public SoalPGDTO updateSoal(Long id, SoalPGDTO dto) {
        SoalPG entity = soalPGRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Soal not found"));

        entity.setPertanyaan(dto.getPertanyaan());
        entity.setPilihanA(dto.getPilihanA() != null && !dto.getPilihanA().trim().isEmpty() ? dto.getPilihanA() : "Benar");
        entity.setPilihanB(dto.getPilihanB() != null && !dto.getPilihanB().trim().isEmpty() ? dto.getPilihanB() : "Salah");
        entity.setPilihanC(dto.getPilihanC() != null && !dto.getPilihanC().trim().isEmpty() ? dto.getPilihanC() : "-");
        entity.setPilihanD(dto.getPilihanD() != null && !dto.getPilihanD().trim().isEmpty() ? dto.getPilihanD() : "-");
        entity.setPilihanE(dto.getPilihanE() != null && !dto.getPilihanE().trim().isEmpty() ? dto.getPilihanE() : "-");
        entity.setKunciJawaban(dto.getKunciJawaban());
        entity.setBobotNilai(dto.getBobotNilai());
        String upTipe = dto.getTipeSoal();
        String upKj = dto.getKunciJawaban() != null ? dto.getKunciJawaban().trim() : "";
        if (upTipe == null || upTipe.isEmpty() || "PG_BIASA".equalsIgnoreCase(upTipe)) {
            if ("Benar".equalsIgnoreCase(entity.getPilihanA()) && "Salah".equalsIgnoreCase(entity.getPilihanB())) {
                upTipe = "BENAR_SALAH";
            } else if (upKj.contains(",") || upKj.contains(";") || upKj.length() > 1) {
                upTipe = "PG_KOMPLEKS";
            }
        }
        if (upTipe != null) entity.setTipeSoal(upTipe);

        SoalPG saved = soalPGRepository.save(entity);
        String fullPertanyaan;
        if ("BENAR_SALAH".equalsIgnoreCase(entity.getTipeSoal())) {
            fullPertanyaan = String.format("%s<br>A. %s<br>B. %s (Format Pernyataan Benar/Salah)",
                    dto.getPertanyaan(), entity.getPilihanA(), entity.getPilihanB());
        } else {
            fullPertanyaan = String.format("%s<br>A. %s<br>B. %s<br>C. %s<br>D. %s<br>E. %s",
                    dto.getPertanyaan(), entity.getPilihanA(), entity.getPilihanB(), entity.getPilihanC(), entity.getPilihanD(),
                    entity.getPilihanE() != null ? entity.getPilihanE() : "-");
        }
        kartuSoalService.generateAndUploadAutoKartuSoal(entity.getUjianMapel(), fullPertanyaan, dto.getKunciJawaban(),
                dto.getBobotNilai(), "PG_Update");

        return mapToDTO(saved);
    }

    private SoalPGDTO mapToDTO(SoalPG s) {
        SoalPGDTO dto = new SoalPGDTO();
        dto.setId(s.getId());
        dto.setUjianId(s.getUjianMapel() != null ? s.getUjianMapel().getId() : null);
        dto.setPertanyaan(s.getPertanyaan());
        dto.setPilihanA(s.getPilihanA());
        dto.setPilihanB(s.getPilihanB());
        dto.setPilihanC(s.getPilihanC());
        dto.setPilihanD(s.getPilihanD());
        dto.setPilihanE(s.getPilihanE());
        dto.setKunciJawaban(s.getKunciJawaban());
        dto.setBobotNilai(s.getBobotNilai());

        // Smart detection of tipeSoal
        String tipe = s.getTipeSoal();
        String kj = s.getKunciJawaban() != null ? s.getKunciJawaban().trim() : "";
        String pert = s.getPertanyaan() != null ? s.getPertanyaan().toLowerCase() : "";
        boolean hasComplexHint = pert.contains("lebih dari 1") || pert.contains("lebih dari satu") ||
                pert.contains("kompleks") || pert.contains("pilih 2") || pert.contains("pilihlah dua");

        if (tipe == null || tipe.trim().isEmpty() || "PG_BIASA".equalsIgnoreCase(tipe)) {
            if (("Benar".equalsIgnoreCase(s.getPilihanA()) || "True".equalsIgnoreCase(s.getPilihanA())) &&
                ("Salah".equalsIgnoreCase(s.getPilihanB()) || "False".equalsIgnoreCase(s.getPilihanB())) &&
                (s.getPilihanC() == null || "-".equals(s.getPilihanC().trim()) || s.getPilihanC().trim().isEmpty())) {
                tipe = "BENAR_SALAH";
            } else if (kj.contains(",") || kj.contains(";") || kj.length() > 1 || hasComplexHint) {
                tipe = "PG_KOMPLEKS";
            } else {
                tipe = "PG_BIASA";
            }
        }
        dto.setTipeSoal(tipe);

        if ("BENAR_SALAH".equalsIgnoreCase(tipe)) {
            if ("-".equals(dto.getPilihanC())) dto.setPilihanC("");
            if ("-".equals(dto.getPilihanD())) dto.setPilihanD("");
            if ("-".equals(dto.getPilihanE())) dto.setPilihanE("");
        }

        return dto;
    }
}
