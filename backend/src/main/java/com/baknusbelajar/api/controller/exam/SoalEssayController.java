package com.baknusbelajar.api.controller.exam;

import com.baknusbelajar.api.dto.exam.SoalEssayDTO;
import com.baknusbelajar.api.service.SoalEssayService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exam/soal-essay")
@RequiredArgsConstructor
public class SoalEssayController {

    private final SoalEssayService soalEssayService;

    @GetMapping("/ujian/{ujianId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU', 'SISWA')")
    public ResponseEntity<List<SoalEssayDTO>> getByUjian(@PathVariable Long ujianId, Authentication authentication) {
        boolean isGuruOrTUOrAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_GURU") ||
                        a.getAuthority().equals("ROLE_TU") ||
                        a.getAuthority().equals("ROLE_ADMIN"));

        // Hide Kunci Jawaban if requested by SISWA
        return ResponseEntity.ok(soalEssayService.getSoalByUjian(ujianId, isGuruOrTUOrAdmin));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<SoalEssayDTO> create(@RequestBody SoalEssayDTO dto) {
        return ResponseEntity.ok(soalEssayService.createSoal(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<SoalEssayDTO> update(@PathVariable Long id, @RequestBody SoalEssayDTO dto) {
        return ResponseEntity.ok(soalEssayService.updateSoal(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        soalEssayService.deleteSoal(id);
        return ResponseEntity.ok().build();
    }
}
