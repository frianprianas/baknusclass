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
        UjianMapel ujian = ujianMapelRepository.findById(dto.getUjianId())
                .orElseThrow(() -> new RuntimeException("Ujian not found"));

        SoalPG entity = new SoalPG();
        entity.setUjianMapel(ujian);
        entity.setPertanyaan(dto.getPertanyaan());
        entity.setPilihanA(dto.getPilihanA());
        entity.setPilihanB(dto.getPilihanB());
        entity.setPilihanC(dto.getPilihanC());
        entity.setPilihanD(dto.getPilihanD());
        entity.setPilihanE(dto.getPilihanE());
        entity.setKunciJawaban(dto.getKunciJawaban());
        entity.setBobotNilai(dto.getBobotNilai());

        return mapToDTO(soalPGRepository.save(entity));
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
        entity.setPilihanA(dto.getPilihanA());
        entity.setPilihanB(dto.getPilihanB());
        entity.setPilihanC(dto.getPilihanC());
        entity.setPilihanD(dto.getPilihanD());
        entity.setPilihanE(dto.getPilihanE());
        entity.setKunciJawaban(dto.getKunciJawaban());
        entity.setBobotNilai(dto.getBobotNilai());

        return mapToDTO(soalPGRepository.save(entity));
    }

    private SoalPGDTO mapToDTO(SoalPG s) {
        SoalPGDTO dto = new SoalPGDTO();
        dto.setId(s.getId());
        dto.setUjianId(s.getUjianMapel().getId());
        dto.setPertanyaan(s.getPertanyaan());
        dto.setPilihanA(s.getPilihanA());
        dto.setPilihanB(s.getPilihanB());
        dto.setPilihanC(s.getPilihanC());
        dto.setPilihanD(s.getPilihanD());
        dto.setPilihanE(s.getPilihanE());
        dto.setKunciJawaban(s.getKunciJawaban());
        dto.setBobotNilai(s.getBobotNilai());
        return dto;
    }
}
