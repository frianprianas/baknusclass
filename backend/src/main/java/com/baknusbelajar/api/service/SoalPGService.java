package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.exam.SoalPGDTO;
import com.baknusbelajar.api.entity.SoalPG;
import com.baknusbelajar.api.entity.UjianMapel;
import com.baknusbelajar.api.repository.SoalPGRepository;
import com.baknusbelajar.api.repository.JawabanPGRepository;
import com.baknusbelajar.api.repository.UjianMapelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SoalPGService {

    private final SoalPGRepository soalPGRepository;
    private final JawabanPGRepository jawabanPGRepository;
    private final UjianMapelRepository ujianMapelRepository;
    private final KartuSoalService kartuSoalService;
    private final JawabanPGService jawabanPGService;

    @Transactional
    public List<SoalPGDTO> getSoalByUjian(Long ujianId, boolean includeKunci) {
        List<SoalPG> soalList = soalPGRepository.findByUjianMapelId(ujianId);
        if (soalList.isEmpty()) {
            tryAutoCopyQuestions(ujianId);
            soalList = soalPGRepository.findByUjianMapelId(ujianId);
        }
        return soalList.stream().map(s -> {
            // Respect existing tipeSoal. Only fallback if null or empty.
            if (s.getTipeSoal() == null || s.getTipeSoal().trim().isEmpty()) {
                String kj = s.getKunciJawaban() != null ? s.getKunciJawaban().trim() : "";
                boolean isMultiKey = kj.contains(",") || kj.contains(";") || kj.matches("(?i).*[A-E].*[A-E].*");
                if (isMultiKey) {
                    s.setTipeSoal("PG_KOMPLEKS");
                } else if (("Benar".equalsIgnoreCase(s.getPilihanA()) || "True".equalsIgnoreCase(s.getPilihanA())) &&
                           ("Salah".equalsIgnoreCase(s.getPilihanB()) || "False".equalsIgnoreCase(s.getPilihanB()))) {
                    s.setTipeSoal("BENAR_SALAH");
                } else {
                    s.setTipeSoal("PG_BIASA");
                }
                soalPGRepository.save(s);
            }

            SoalPGDTO dto = mapToDTO(s);
            if (!includeKunci) {
                dto.setKunciJawaban(null);
            }
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
        } else if ("BS_MAJEMUK".equalsIgnoreCase(entity.getTipeSoal())) {
            fullPertanyaan = String.format("%s<br>Tabel Benar/Salah:<br>1. %s<br>2. %s<br>3. %s<br>4. %s",
                    dto.getPertanyaan(), entity.getPilihanA(), entity.getPilihanB(),
                    entity.getPilihanC() != null ? entity.getPilihanC() : "-",
                    entity.getPilihanD() != null ? entity.getPilihanD() : "-");
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
    @Transactional
    public void deleteSoal(Long id) {
        jawabanPGRepository.deleteBySoalPGId(id);
        soalPGRepository.deleteById(id);
    }

    @CacheEvict(value = "soalPGCache", allEntries = true)
    @Transactional
    public SoalPGDTO updateKunciJawaban(Long id, String newKunci) {
        SoalPG entity = soalPGRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Soal not found with ID: " + id));

        String kj = newKunci != null ? newKunci.trim() : "";
        entity.setKunciJawaban(kj);

        boolean isMultiKey = kj.contains(",") || kj.contains(";") || kj.matches("(?i).*[A-E].*[A-E].*");
        if (isMultiKey) {
            entity.setTipeSoal("PG_KOMPLEKS");
        } else if ("Benar".equalsIgnoreCase(entity.getPilihanA()) && "Salah".equalsIgnoreCase(entity.getPilihanB())) {
            entity.setTipeSoal("BENAR_SALAH");
        } else {
            entity.setTipeSoal("PG_BIASA");
        }

        SoalPG saved = soalPGRepository.save(entity);
        jawabanPGService.reevaluateAllJawabanForSoal(saved);
        return mapToDTO(saved);
    }

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
        } else if ("BS_MAJEMUK".equalsIgnoreCase(entity.getTipeSoal())) {
            fullPertanyaan = String.format("%s<br>Tabel Benar/Salah:<br>1. %s<br>2. %s<br>3. %s<br>4. %s",
                    dto.getPertanyaan(), entity.getPilihanA(), entity.getPilihanB(),
                    entity.getPilihanC() != null ? entity.getPilihanC() : "-",
                    entity.getPilihanD() != null ? entity.getPilihanD() : "-");
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

        // Preserve explicitly saved tipeSoal without aggressive keyword override
        String tipe = s.getTipeSoal();
        String kj = s.getKunciJawaban() != null ? s.getKunciJawaban().trim() : "";
        boolean isMultiKey = kj.contains(",") || kj.contains(";") || kj.matches("(?i).*[A-E].*[A-E].*");

        if (tipe == null || tipe.trim().isEmpty()) {
            if (("Benar".equalsIgnoreCase(s.getPilihanA()) || "True".equalsIgnoreCase(s.getPilihanA())) &&
                ("Salah".equalsIgnoreCase(s.getPilihanB()) || "False".equalsIgnoreCase(s.getPilihanB())) &&
                (s.getPilihanC() == null || "-".equals(s.getPilihanC().trim()) || s.getPilihanC().trim().isEmpty())) {
                tipe = "BENAR_SALAH";
            } else if (isMultiKey) {
                tipe = "PG_KOMPLEKS";
            } else {
                tipe = "PG_BIASA";
            }
        }
        dto.setTipeSoal(tipe);

        if ("BENAR_SALAH".equalsIgnoreCase(tipe) || "BS_MAJEMUK".equalsIgnoreCase(tipe)) {
            if ("-".equals(dto.getPilihanC())) dto.setPilihanC("");
            if ("-".equals(dto.getPilihanD())) dto.setPilihanD("");
            if ("-".equals(dto.getPilihanE())) dto.setPilihanE("");
        }

        return dto;
    }

    private void tryAutoCopyQuestions(Long targetId) {
        try {
            UjianMapel target = ujianMapelRepository.findById(targetId).orElse(null);
            if (target == null || target.getMapel() == null) return;
            String targetMapelName = target.getMapel().getNamaMapel() != null ? target.getMapel().getNamaMapel().toLowerCase() : "";

            List<UjianMapel> all = ujianMapelRepository.findAll();
            for (UjianMapel other : all) {
                if (other.getId().equals(targetId)) continue;
                String otherMapel = (other.getMapel() != null && other.getMapel().getNamaMapel() != null)
                        ? other.getMapel().getNamaMapel().toLowerCase() : "";
                if (otherMapel.equals(targetMapelName) || (targetMapelName.contains("ujicoba") && otherMapel.contains("ujicoba"))) {
                    List<SoalPG> otherPG = soalPGRepository.findByUjianMapelId(other.getId());
                    if (!otherPG.isEmpty()) {
                        log.info("[SoalPG] On-demand auto-copying {} PG questions from exam {} to exam {}", otherPG.size(), other.getId(), targetId);
                        for (SoalPG spg : otherPG) {
                            SoalPG newPG = SoalPG.builder()
                                    .ujianMapel(target)
                                    .pertanyaan(spg.getPertanyaan())
                                    .pilihanA(spg.getPilihanA())
                                    .pilihanB(spg.getPilihanB())
                                    .pilihanC(spg.getPilihanC())
                                    .pilihanD(spg.getPilihanD())
                                    .pilihanE(spg.getPilihanE())
                                    .kunciJawaban(spg.getKunciJawaban())
                                    .bobotNilai(spg.getBobotNilai())
                                    .tipeSoal(spg.getTipeSoal() != null ? spg.getTipeSoal() : "PG_BIASA")
                                    .build();
                            soalPGRepository.save(newPG);
                        }
                        break;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[SoalPG] tryAutoCopyQuestions error: {}", e.getMessage());
        }
    }
}
