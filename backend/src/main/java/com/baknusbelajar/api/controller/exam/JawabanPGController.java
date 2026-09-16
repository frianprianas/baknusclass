package com.baknusbelajar.api.controller.exam;

import com.baknusbelajar.api.dto.exam.JawabanPGDTO;
import com.baknusbelajar.api.service.JawabanPGService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/exam/jawaban-pg")
@RequiredArgsConstructor
public class JawabanPGController {

    private final JawabanPGService jawabanPGService;

    @GetMapping("/siswa/{siswaId}/ujian/{ujianId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU', 'SISWA')")
    public ResponseEntity<List<JawabanPGDTO>> getBySiswaAndUjian(@PathVariable Long siswaId, @PathVariable Long ujianId) {
        return ResponseEntity.ok(jawabanPGService.getJawabanBySiswaAndUjian(siswaId, ujianId));
    }

    @GetMapping("/ujian/{ujianId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<List<JawabanPGDTO>> getByUjian(@PathVariable Long ujianId) {
        return ResponseEntity.ok(jawabanPGService.getJawabanByUjian(ujianId));
    }

    @PostMapping("/submit")
    @PreAuthorize("hasRole('SISWA')")
    public ResponseEntity<JawabanPGDTO> submitJawaban(@RequestBody JawabanPGDTO dto) {
        return ResponseEntity.ok(jawabanPGService.submitJawaban(dto));
    }
}
