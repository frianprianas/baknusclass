package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.exam.SoalEssayDTO;
import com.baknusbelajar.api.entity.SoalEssay;
import com.baknusbelajar.api.entity.UjianMapel;
import com.baknusbelajar.api.repository.SoalEssayRepository;
import com.baknusbelajar.api.repository.UjianMapelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SoalEssayService {

    private final SoalEssayRepository soalEssayRepository;
    private final UjianMapelRepository ujianMapelRepository;
    private final KartuSoalService kartuSoalService;

    @Cacheable(value = "soalEssayCache", key = "#ujianId + '-' + #withKunci")
    public List<SoalEssayDTO> getSoalByUjian(Long ujianId, boolean withKunci) {
        return soalEssayRepository.findByUjianMapelId(ujianId).stream()
                .map(entity -> mapToDTO(entity, withKunci))
                .collect(Collectors.toList());
    }

    @CacheEvict(value = "soalEssayCache", allEntries = true)
    public SoalEssayDTO createSoal(SoalEssayDTO dto) {
        Long uId = dto.getUjianMapelId() != null ? dto.getUjianMapelId() : dto.getUjianId();
        if (uId == null) {
            throw new IllegalArgumentException("ID Ujian tidak boleh kosong (ujianMapelId / ujianId wajib ada)");
        }
        UjianMapel ujian = ujianMapelRepository.findById(uId)
                .orElseThrow(() -> new RuntimeException("UjianMapel tidak ditemukan dengan ID: " + uId));

        SoalEssay entity = new SoalEssay();
        entity.setUjianMapel(ujian);
        entity.setPertanyaan(dto.getPertanyaan());
        entity.setKunciJawaban(dto.getKunciJawaban());
        entity.setBobotNilai(dto.getBobotNilai());

        SoalEssay saved = soalEssayRepository.save(entity);
        try {
            kartuSoalService.generateAndUploadAutoKartuSoal(ujian, dto.getPertanyaan(), dto.getKunciJawaban(),
                    dto.getBobotNilai(), "Essay");
        } catch (Exception e) {
            // Do not fail DB save if drive upload has an issue
        }
        return mapToDTO(saved, true);
    }

    @CacheEvict(value = "soalEssayCache", allEntries = true)
    public SoalEssayDTO updateSoal(Long id, SoalEssayDTO dto) {
        SoalEssay entity = soalEssayRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Soal not found"));

        entity.setPertanyaan(dto.getPertanyaan());
        entity.setKunciJawaban(dto.getKunciJawaban());
        entity.setBobotNilai(dto.getBobotNilai());

        SoalEssay saved = soalEssayRepository.save(entity);
        kartuSoalService.generateAndUploadAutoKartuSoal(entity.getUjianMapel(), dto.getPertanyaan(),
                dto.getKunciJawaban(), dto.getBobotNilai(), "Essay_Update");
        return mapToDTO(saved, true);
    }

    @CacheEvict(value = "soalEssayCache", allEntries = true)
    public void deleteSoal(Long id) {
        soalEssayRepository.deleteById(id);
    }

    private SoalEssayDTO mapToDTO(SoalEssay entity, boolean includeKunci) {
        SoalEssayDTO dto = new SoalEssayDTO();
        dto.setId(entity.getId());
        dto.setPertanyaan(entity.getPertanyaan());
        dto.setBobotNilai(entity.getBobotNilai());
        if (includeKunci) {
            dto.setKunciJawaban(entity.getKunciJawaban());
        }
        if (entity.getUjianMapel() != null) {
            dto.setUjianMapelId(entity.getUjianMapel().getId());
        }
        return dto;
    }
}
