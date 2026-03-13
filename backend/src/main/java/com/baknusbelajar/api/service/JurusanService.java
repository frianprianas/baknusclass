package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.master.JurusanDTO;
import com.baknusbelajar.api.entity.Jurusan;
import com.baknusbelajar.api.repository.JurusanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class JurusanService {

    private final JurusanRepository jurusanRepository;

    public List<JurusanDTO> getAllJurusan() {
        return jurusanRepository.findAll().stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public JurusanDTO getJurusanById(Long id) {
        return jurusanRepository.findById(id).map(this::mapToDTO)
                .orElseThrow(() -> new RuntimeException("Jurusan not found"));
    }

    public JurusanDTO createJurusan(JurusanDTO dto) {
        Jurusan entity = new Jurusan();
        entity.setKodeJurusan(dto.getKodeJurusan());
        entity.setNamaJurusan(dto.getNamaJurusan());
        return mapToDTO(jurusanRepository.save(entity));
    }

    public JurusanDTO updateJurusan(Long id, JurusanDTO dto) {
        Jurusan entity = jurusanRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Jurusan not found"));
        entity.setKodeJurusan(dto.getKodeJurusan());
        entity.setNamaJurusan(dto.getNamaJurusan());
        return mapToDTO(jurusanRepository.save(entity));
    }

    public void deleteJurusan(Long id) {
        jurusanRepository.deleteById(id);
    }

    private JurusanDTO mapToDTO(Jurusan entity) {
        JurusanDTO dto = new JurusanDTO();
        dto.setId(entity.getId());
        dto.setKodeJurusan(entity.getKodeJurusan());
        dto.setNamaJurusan(entity.getNamaJurusan());
        return dto;
    }
}
