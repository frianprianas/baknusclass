package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.master.KelasDTO;
import com.baknusbelajar.api.entity.Jurusan;
import com.baknusbelajar.api.entity.Kelas;
import com.baknusbelajar.api.repository.JurusanRepository;
import com.baknusbelajar.api.repository.KelasRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class KelasService {

    private final KelasRepository kelasRepository;
    private final JurusanRepository jurusanRepository;

    public List<KelasDTO> getAllKelas() {
        return kelasRepository.findAll().stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public KelasDTO getKelasById(Long id) {
        return kelasRepository.findById(id).map(this::mapToDTO)
                .orElseThrow(() -> new RuntimeException("Kelas not found"));
    }

    public KelasDTO createKelas(KelasDTO dto) {
        Jurusan jurusan = jurusanRepository.findById(dto.getJurusanId())
                .orElseThrow(() -> new RuntimeException("Jurusan not found"));

        Kelas entity = new Kelas();
        entity.setTingkat(dto.getTingkat());
        entity.setNamaKelas(dto.getNamaKelas());
        entity.setJurusan(jurusan);

        return mapToDTO(kelasRepository.save(entity));
    }

    public KelasDTO updateKelas(Long id, KelasDTO dto) {
        Kelas entity = kelasRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Kelas not found"));

        Jurusan jurusan = jurusanRepository.findById(dto.getJurusanId())
                .orElseThrow(() -> new RuntimeException("Jurusan not found"));

        entity.setTingkat(dto.getTingkat());
        entity.setNamaKelas(dto.getNamaKelas());
        entity.setJurusan(jurusan);

        return mapToDTO(kelasRepository.save(entity));
    }

    public void deleteKelas(Long id) {
        kelasRepository.deleteById(id);
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
