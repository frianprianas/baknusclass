package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.master.MapelDTO;
import com.baknusbelajar.api.entity.Mapel;
import com.baknusbelajar.api.repository.MapelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MapelService {

    private final MapelRepository mapelRepository;

    public List<MapelDTO> getAllMapel() {
        return mapelRepository.findAll().stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public MapelDTO getMapelById(Long id) {
        return mapelRepository.findById(id).map(this::mapToDTO)
                .orElseThrow(() -> new RuntimeException("Mapel not found"));
    }

    public MapelDTO createMapel(MapelDTO dto) {
        Mapel entity = new Mapel();
        entity.setKodeMapel(dto.getKodeMapel());
        entity.setNamaMapel(dto.getNamaMapel());
        return mapToDTO(mapelRepository.save(entity));
    }

    public MapelDTO updateMapel(Long id, MapelDTO dto) {
        Mapel entity = mapelRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Mapel not found"));
        entity.setKodeMapel(dto.getKodeMapel());
        entity.setNamaMapel(dto.getNamaMapel());
        return mapToDTO(mapelRepository.save(entity));
    }

    public void deleteMapel(Long id) {
        mapelRepository.deleteById(id);
    }

    private MapelDTO mapToDTO(Mapel entity) {
        MapelDTO dto = new MapelDTO();
        dto.setId(entity.getId());
        dto.setKodeMapel(entity.getKodeMapel());
        dto.setNamaMapel(entity.getNamaMapel());
        return dto;
    }
}
