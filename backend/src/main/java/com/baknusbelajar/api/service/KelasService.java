package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.master.KelasDTO;
import com.baknusbelajar.api.entity.GuruMapel;
import com.baknusbelajar.api.entity.Jurusan;
import com.baknusbelajar.api.entity.Kelas;
import com.baknusbelajar.api.entity.Siswa;
import com.baknusbelajar.api.repository.GuruMapelRepository;
import com.baknusbelajar.api.repository.JurusanRepository;
import com.baknusbelajar.api.repository.KelasRepository;
import com.baknusbelajar.api.repository.SiswaRepository;
import com.baknusbelajar.api.repository.UjianMapelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class KelasService {

    private final KelasRepository kelasRepository;
    private final JurusanRepository jurusanRepository;
    private final SiswaRepository siswaRepository;
    private final GuruMapelRepository guruMapelRepository;
    private final UjianMapelRepository ujianMapelRepository;

    public List<KelasDTO> getAllKelas() {
        return kelasRepository.findAll().stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public KelasDTO getKelasById(Long id) {
        return kelasRepository.findById(id).map(this::mapToDTO)
                .orElseThrow(() -> new RuntimeException("Kelas tidak ditemukan (ID: " + id + ")"));
    }

    @Transactional
    public KelasDTO createKelas(KelasDTO dto) {
        Jurusan jurusan = null;
        if (dto.getJurusanId() != null) {
            jurusan = jurusanRepository.findById(dto.getJurusanId()).orElse(null);
        }
        if (jurusan == null) {
            jurusan = jurusanRepository.findAll().stream().findFirst()
                    .orElseThrow(() -> new RuntimeException("Jurusan tidak ditemukan"));
        }

        Kelas entity = new Kelas();
        entity.setTingkat(dto.getTingkat() != null ? dto.getTingkat().trim() : "X");
        entity.setNamaKelas(dto.getNamaKelas() != null ? dto.getNamaKelas().trim() : "");
        entity.setJurusan(jurusan);

        return mapToDTO(kelasRepository.save(entity));
    }

    @Transactional
    public KelasDTO updateKelas(Long id, KelasDTO dto) {
        Kelas entity = kelasRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Kelas tidak ditemukan (ID: " + id + ")"));

        Jurusan jurusan = null;
        if (dto.getJurusanId() != null) {
            jurusan = jurusanRepository.findById(dto.getJurusanId()).orElse(null);
        }
        if (jurusan == null) {
            jurusan = entity.getJurusan();
        }
        if (jurusan == null) {
            jurusan = jurusanRepository.findAll().stream().findFirst()
                    .orElseThrow(() -> new RuntimeException("Jurusan tidak ditemukan"));
        }

        if (dto.getTingkat() != null && !dto.getTingkat().trim().isEmpty()) {
            entity.setTingkat(dto.getTingkat().trim());
        }
        if (dto.getNamaKelas() != null && !dto.getNamaKelas().trim().isEmpty()) {
            entity.setNamaKelas(dto.getNamaKelas().trim());
        }
        entity.setJurusan(jurusan);

        return mapToDTO(kelasRepository.save(entity));
    }

    @Transactional
    public void deleteKelas(Long id) {
        Kelas kelas = kelasRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Kelas tidak ditemukan (ID: " + id + ")"));

        // 1. Unlink siswa dari kelas ini agar tidak melanggar foreign key constraint
        List<Siswa> siswaList = siswaRepository.findByKelasId(id);
        for (Siswa s : siswaList) {
            s.setKelas(null);
            siswaRepository.save(s);
        }

        // 2. Hapus relasi guru-mapel jika ada
        List<GuruMapel> guruMapelList = guruMapelRepository.findByKelasId(id);
        for (GuruMapel gm : guruMapelList) {
            guruMapelRepository.delete(gm);
        }

        // 3. Lepaskan dari ujian yang memakai kelas ini jika ada
        try {
            ujianMapelRepository.findAll().forEach(u -> {
                if (u.getKelasList() != null && u.getKelasList().removeIf(k -> k.getId().equals(id))) {
                    ujianMapelRepository.save(u);
                }
            });
        } catch (Exception e) {
            log.warn("Gagal unlink ujian kelas: {}", e.getMessage());
        }

        // 4. Hapus data kelas
        kelasRepository.delete(kelas);
    }

    @Transactional
    public int cleanupInvalidKelas() {
        List<Kelas> allClasses = kelasRepository.findAll();
        int count = 0;
        for (Kelas k : allClasses) {
            String nama = k.getNamaKelas();
            if (nama == null) continue;
            nama = nama.trim().toUpperCase();
            if (nama.contains("E+") || nama.contains("E-") || nama.matches("^[\\d.,\\s]+$")) {
                deleteKelas(k.getId());
                count++;
            }
        }
        return count;
    }

    private KelasDTO mapToDTO(Kelas entity) {
        KelasDTO dto = new KelasDTO();
        dto.setId(entity.getId());
        dto.setTingkat(entity.getTingkat());
        dto.setNamaKelas(entity.getNamaKelas());
        if (entity.getJurusan() != null) {
            dto.setJurusanId(entity.getJurusan().getId());
            dto.setNamaJurusan(entity.getJurusan().getNamaJurusan());
        }
        return dto;
    }
}
