package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.enrollment.SiswaMapelDTO;
import com.baknusbelajar.api.entity.GuruMapel;
import com.baknusbelajar.api.entity.Mapel;
import com.baknusbelajar.api.entity.Siswa;
import com.baknusbelajar.api.entity.SiswaMapel;
import com.baknusbelajar.api.repository.GuruMapelRepository;
import com.baknusbelajar.api.repository.MapelRepository;
import com.baknusbelajar.api.repository.SiswaMapelRepository;
import com.baknusbelajar.api.repository.SiswaRepository;
import com.baknusbelajar.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SiswaMapelService {

    private final SiswaMapelRepository siswaMapelRepository;
    private final SiswaRepository siswaRepository;
    private final MapelRepository mapelRepository;
    private final GuruMapelRepository guruMapelRepository;
    private final UserRepository userRepository;

    public List<SiswaMapelDTO> getAllSiswaMapel() {
        return siswaMapelRepository.findAll().stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<SiswaMapelDTO> getMapelForStudent(String usernameOrEmail) {
        log.info("[getMapelForStudent] Looking up student: {}", usernameOrEmail);
        Optional<Siswa> siswaOpt = siswaRepository.findByUserUsername(usernameOrEmail);
        if (siswaOpt.isEmpty()) {
            siswaOpt = userRepository.findByEmail(usernameOrEmail)
                    .flatMap(u -> siswaRepository.findByUserId(u.getId()));
        }
        if (siswaOpt.isEmpty()) {
            siswaOpt = userRepository.findByUsername(usernameOrEmail)
                    .flatMap(u -> siswaRepository.findByUserId(u.getId()));
        }

        return siswaOpt.map(s -> getMapelBySiswaId(s.getId())).orElse(Collections.emptyList());
    }

    public List<SiswaMapelDTO> getMapelBySiswaId(Long siswaId) {
        List<SiswaMapelDTO> result = new ArrayList<>();
        Set<Long> mapelIds = new HashSet<>();

        // 1. Direct enrollments from tb_siswa_mapel
        List<SiswaMapel> directList = siswaMapelRepository.findBySiswaId(siswaId);
        for (SiswaMapel sm : directList) {
            if (sm.getMapel() != null) {
                SiswaMapelDTO dto = mapToDTO(sm);
                mapelIds.add(sm.getMapel().getId());
                result.add(dto);
            }
        }

        // 2. Class-based enrollments from tb_guru_mapel (if student has a kelas)
        siswaRepository.findById(siswaId).ifPresent(s -> {
            if (s.getKelas() != null) {
                List<GuruMapel> gmList = guruMapelRepository.findByKelasId(s.getKelas().getId());
                for (GuruMapel gm : gmList) {
                    if (gm.getMapel() != null && !mapelIds.contains(gm.getMapel().getId())) {
                        mapelIds.add(gm.getMapel().getId());
                        SiswaMapelDTO dto = new SiswaMapelDTO();
                        dto.setId(gm.getId());
                        dto.setSiswaId(s.getId());
                        dto.setNamaSiswa(s.getNamaLengkap());
                        dto.setNisn(s.getNisn());
                        dto.setKelasId(s.getKelas().getId());
                        dto.setNamaKelas(s.getKelas().getNamaKelas());
                        dto.setMapelId(gm.getMapel().getId());
                        dto.setNamaMapel(gm.getMapel().getNamaMapel());
                        dto.setKodeMapel(gm.getMapel().getKodeMapel());
                        if (gm.getGuru() != null) {
                            dto.setNamaGuru(gm.getGuru().getNamaLengkap());
                        }
                        result.add(dto);
                    }
                }
            }
        });

        // 3. Resolve namaGuru and kodeMapel for direct enrollments if missing
        for (SiswaMapelDTO dto : result) {
            if ((dto.getNamaGuru() == null || dto.getKodeMapel() == null) && dto.getKelasId() != null && dto.getMapelId() != null) {
                List<GuruMapel> gmList = guruMapelRepository.findByKelasId(dto.getKelasId());
                for (GuruMapel gm : gmList) {
                    if (gm.getMapel() != null && gm.getMapel().getId().equals(dto.getMapelId())) {
                        if (dto.getNamaGuru() == null && gm.getGuru() != null) {
                            dto.setNamaGuru(gm.getGuru().getNamaLengkap());
                        }
                        if (dto.getKodeMapel() == null) {
                            dto.setKodeMapel(gm.getMapel().getKodeMapel());
                        }
                        break;
                    }
                }
            }
        }

        return result;
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
            dto.setKodeMapel(entity.getMapel().getKodeMapel());
        }
        return dto;
    }
}
