package com.baknusbelajar.api.controller.exam;

import com.baknusbelajar.api.dto.exam.SoalPGDTO;
import com.baknusbelajar.api.service.SoalPGService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exam/soal-pg")
@RequiredArgsConstructor
public class SoalPGController {

    private final SoalPGService soalPGService;

    @GetMapping("/ujian/{ujianId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU', 'SISWA')")
    public ResponseEntity<List<SoalPGDTO>> getByUjian(@PathVariable Long ujianId, Authentication authentication) {
        boolean isGuruOrTUOrAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_GURU") ||
                        a.getAuthority().equals("ROLE_TU") ||
                        a.getAuthority().equals("ROLE_ADMIN"));

        return ResponseEntity.ok(soalPGService.getSoalByUjian(ujianId, isGuruOrTUOrAdmin));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<SoalPGDTO> create(@RequestBody SoalPGDTO dto) {
        return ResponseEntity.ok(soalPGService.createSoal(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<SoalPGDTO> update(@PathVariable Long id, @RequestBody SoalPGDTO dto) {
        return ResponseEntity.ok(soalPGService.updateSoal(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        soalPGService.deleteSoal(id);
        return ResponseEntity.ok().build();
    }
}
