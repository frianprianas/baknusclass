package com.baknusbelajar.api.controller.master;

import com.baknusbelajar.api.dto.master.MapelDTO;
import com.baknusbelajar.api.service.MapelService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/master/mapel")
@RequiredArgsConstructor
public class MapelController {

    private final MapelService mapelService;

    @GetMapping
    public ResponseEntity<List<MapelDTO>> getAll() {
        return ResponseEntity.ok(mapelService.getAllMapel());
    }

    @GetMapping("/{id}")
    public ResponseEntity<MapelDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(mapelService.getMapelById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<MapelDTO> create(@RequestBody MapelDTO dto) {
        return ResponseEntity.ok(mapelService.createMapel(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<MapelDTO> update(@PathVariable Long id, @RequestBody MapelDTO dto) {
        return ResponseEntity.ok(mapelService.updateMapel(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        mapelService.deleteMapel(id);
        return ResponseEntity.ok().build();
    }
}
