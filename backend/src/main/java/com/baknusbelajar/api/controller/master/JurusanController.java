package com.baknusbelajar.api.controller.master;

import com.baknusbelajar.api.dto.master.JurusanDTO;
import com.baknusbelajar.api.service.JurusanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/master/jurusan")
@RequiredArgsConstructor
public class JurusanController {

    private final JurusanService jurusanService;

    @GetMapping
    public ResponseEntity<List<JurusanDTO>> getAll() {
        return ResponseEntity.ok(jurusanService.getAllJurusan());
    }

    @GetMapping("/{id}")
    public ResponseEntity<JurusanDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(jurusanService.getJurusanById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<JurusanDTO> create(@RequestBody JurusanDTO dto) {
        return ResponseEntity.ok(jurusanService.createJurusan(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<JurusanDTO> update(@PathVariable Long id, @RequestBody JurusanDTO dto) {
        return ResponseEntity.ok(jurusanService.updateJurusan(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        jurusanService.deleteJurusan(id);
        return ResponseEntity.ok().build();
    }
}
