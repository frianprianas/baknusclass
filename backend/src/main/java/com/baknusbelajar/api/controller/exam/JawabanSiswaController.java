package com.baknusbelajar.api.controller.exam;

import com.baknusbelajar.api.dto.exam.JawabanSiswaDTO;
import com.baknusbelajar.api.service.JawabanSiswaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/exam/jawaban")
@RequiredArgsConstructor
public class JawabanSiswaController {

    private final JawabanSiswaService jawabanSiswaService;

    @GetMapping("/soal/{soalId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<List<JawabanSiswaDTO>> getBySoal(@PathVariable Long soalId) {
        return ResponseEntity.ok(jawabanSiswaService.getJawabanBySoal(soalId));
    }

    @GetMapping("/siswa/{siswaId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU', 'SISWA')")
    public ResponseEntity<List<JawabanSiswaDTO>> getBySiswa(@PathVariable Long siswaId) {
        return ResponseEntity.ok(jawabanSiswaService.getJawabanBySiswa(siswaId));
    }

    @GetMapping("/ujian/{ujianId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<List<JawabanSiswaDTO>> getByUjian(@PathVariable Long ujianId) {
        return ResponseEntity.ok(jawabanSiswaService.getJawabanByUjian(ujianId));
    }

    @PostMapping("/submit")
    @PreAuthorize("hasRole('SISWA')")
    public ResponseEntity<JawabanSiswaDTO> submitJawaban(@RequestBody JawabanSiswaDTO dto) {
        JawabanSiswaDTO response = jawabanSiswaService.submitJawaban(dto);
        // AI Scoring removed from auto-trigger to save token/quota.
        // It will be triggered manually by Teachers.
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/ai-score")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<JawabanSiswaDTO> triggerAiScoring(@PathVariable Long id) {
        log.info("Manually triggering AI Scoring for Answer ID: {}", id);
        JawabanSiswaDTO result = jawabanSiswaService.processAiScoringSync(id);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/{id}/nilai")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')") // Teacher or automated AI evaluation system
    public ResponseEntity<JawabanSiswaDTO> updateNilai(
            @PathVariable Long id,
            @RequestParam(required = false) Double skorAi,
            @RequestParam(required = false) String alasanAi,
            @RequestParam(required = false) Double skorGuru) {
        return ResponseEntity.ok(jawabanSiswaService.updateNilai(id, skorAi, alasanAi, skorGuru));
    }

    @PostMapping("/ujian/{ujianId}/sync-drive")
    @PreAuthorize("hasAnyRole('ADMIN', 'GURU')")
    public ResponseEntity<String> syncToDrive(@PathVariable Long ujianId) {
        log.info("Syncing Exam ID {} to BaknusDrive", ujianId);
        jawabanSiswaService.syncToBaknusDrive(ujianId);
        return ResponseEntity.ok("Berhasil sinkronisasi ke BaknusDrive");
    }
}
