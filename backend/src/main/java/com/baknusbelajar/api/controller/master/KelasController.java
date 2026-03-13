package com.baknusbelajar.api.controller.master;

import com.baknusbelajar.api.dto.master.KelasDTO;
import com.baknusbelajar.api.service.KelasService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/master/kelas")
@RequiredArgsConstructor
public class KelasController {

    private final KelasService kelasService;

    @GetMapping
    public ResponseEntity<List<KelasDTO>> getAll() {
        return ResponseEntity.ok(kelasService.getAllKelas());
    }

    @GetMapping("/{id}")
    public ResponseEntity<KelasDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(kelasService.getKelasById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<KelasDTO> create(@RequestBody KelasDTO dto) {
        return ResponseEntity.ok(kelasService.createKelas(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<KelasDTO> update(@PathVariable Long id, @RequestBody KelasDTO dto) {
        return ResponseEntity.ok(kelasService.updateKelas(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        kelasService.deleteKelas(id);
        return ResponseEntity.ok().build();
    }
}
