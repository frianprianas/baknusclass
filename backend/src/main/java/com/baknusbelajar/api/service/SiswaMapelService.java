package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.enrollment.SiswaMapelDTO;
import com.baknusbelajar.api.entity.Mapel;
import com.baknusbelajar.api.entity.Siswa;
import com.baknusbelajar.api.entity.SiswaMapel;
import com.baknusbelajar.api.repository.MapelRepository;
import com.baknusbelajar.api.repository.SiswaMapelRepository;
import com.baknusbelajar.api.repository.SiswaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SiswaMapelService {

    private final SiswaMapelRepository siswaMapelRepository;
    private final SiswaRepository siswaRepository;
    private final MapelRepository mapelRepository;

    public List<SiswaMapelDTO> getAllSiswaMapel() {
        return siswaMapelRepository.findAll().stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<SiswaMapelDTO> getMapelBySiswaId(Long siswaId) {
        return siswaMapelRepository.findBySiswaId(siswaId).stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    /** Get all students enrolled in a specific mapel */
    public List<SiswaMapelDTO> getEnrolledByMapelId(Long mapelId) {
        return siswaMapelRepository.findByMapelId(mapelId).stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<java.util.Map<String, Object>> getAllSiswaPlain() {
        return siswaRepository.findAll().stream().map(s -> {
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", s.getId());
            map.put("namaSiswa", s.getNamaLengkap());
            map.put("nisn", s.getNisn());
            map.put("kelas", s.getKelas() != null ? s.getKelas().getNamaKelas() : "-");
            return map;
        }).collect(Collectors.toList());
    }

    public SiswaMapelDTO createSiswaMapel(SiswaMapelDTO dto) {
        if (siswaMapelRepository.existsBySiswaIdAndMapelId(dto.getSiswaId(), dto.getMapelId())) {
            throw new RuntimeException("Siswa sudah terdaftar di mata pelajaran ini");
        }
        Siswa siswa = siswaRepository.findById(dto.getSiswaId())
                .orElseThrow(() -> new RuntimeException("Siswa not found"));
        Mapel mapel = mapelRepository.findById(dto.getMapelId())
                .orElseThrow(() -> new RuntimeException("Mapel not found"));

        SiswaMapel entity = new SiswaMapel();
        entity.setSiswa(siswa);
        entity.setMapel(mapel);

        return mapToDTO(siswaMapelRepository.save(entity));
    }

    /**
     * Import all students from a specific class (kelasId) to a mapel.
     * Skips students already enrolled.
     * Returns count of newly enrolled students.
     */
    @Transactional
    public int importByKelas(Long mapelId, Long kelasId) {
        Mapel mapel = mapelRepository.findById(mapelId)
                .orElseThrow(() -> new RuntimeException("Mapel not found: " + mapelId));

        List<Siswa> siswaList = siswaRepository.findByKelasId(kelasId);

        int imported = 0;
        for (Siswa siswa : siswaList) {
            if (!siswaMapelRepository.existsBySiswaIdAndMapelId(siswa.getId(), mapelId)) {
                SiswaMapel enrollment = new SiswaMapel();
                enrollment.setSiswa(siswa);
                enrollment.setMapel(mapel);
                siswaMapelRepository.save(enrollment);
                imported++;
            }
        }
        log.info("Imported {} students from kelasId={} to mapelId={}", imported, kelasId, mapelId);
        return imported;
    }

    public void deleteSiswaMapel(Long id) {
        siswaMapelRepository.deleteById(id);
    }

    private SiswaMapelDTO mapToDTO(SiswaMapel entity) {
        SiswaMapelDTO dto = new SiswaMapelDTO();
        dto.setId(entity.getId());
        if (entity.getSiswa() != null) {
            Siswa s = entity.getSiswa();
            dto.setSiswaId(s.getId());
            dto.setNamaSiswa(s.getNamaLengkap());
            dto.setNisn(s.getNisn());
            if (s.getKelas() != null) {
                dto.setKelasId(s.getKelas().getId());
                dto.setNamaKelas(s.getKelas().getNamaKelas());
            }
        }
        if (entity.getMapel() != null) {
            dto.setMapelId(entity.getMapel().getId());
            dto.setNamaMapel(entity.getMapel().getNamaMapel());
        }
        return dto;
    }
}
