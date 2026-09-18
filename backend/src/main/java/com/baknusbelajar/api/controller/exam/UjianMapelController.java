package com.baknusbelajar.api.controller.exam;

import com.baknusbelajar.api.dto.exam.UjianMapelDTO;
import com.baknusbelajar.api.service.UjianMapelService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.baknusbelajar.api.security.CustomUserDetails;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/exam/ujian-mapel")
@RequiredArgsConstructor
public class UjianMapelController {

    private final UjianMapelService ujianMapelService;
    private final com.baknusbelajar.api.service.ExamStatusService examStatusService;

    @GetMapping("/event/{eventId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU', 'SISWA')")
    public ResponseEntity<List<UjianMapelDTO>> getByEvent(@PathVariable Long eventId) {
        return ResponseEntity.ok(ujianMapelService.getUjianByEvent(eventId));
    }

    @GetMapping("/siswa")
    @PreAuthorize("hasRole('SISWA')")
    public ResponseEntity<List<UjianMapelDTO>> getForStudent(@RequestParam Long eventId,
            Authentication authentication) {
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        return ResponseEntity.ok(ujianMapelService.getUjianForStudent(eventId, userDetails.getId()));
    }

    @GetMapping("/guru/{guruId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<List<UjianMapelDTO>> getByGuruId(@PathVariable Long guruId) {
        return ResponseEntity.ok(ujianMapelService.getUjianByGuruId(guruId));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<?> create(@RequestBody UjianMapelDTO dto) {
        log.info("[UjianMapel] Create attempt by user: {} with authorities: {}",
                SecurityContextHolder.getContext().getAuthentication().getName(),
                SecurityContextHolder.getContext().getAuthentication().getAuthorities());
        try {
            return ResponseEntity.ok(ujianMapelService.createUjianMapel(dto));
        } catch (Exception e) {
            log.error("[UjianMapel] CREATE ERROR: ", e);
            java.util.Map<String, String> errMap = new java.util.HashMap<>();
            errMap.put("message", e.getMessage() != null ? e.getMessage() : "Unknown internal error");
            errMap.put("error", e.getClass().getName());
            return ResponseEntity.status(500).body(errMap);
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody UjianMapelDTO dto) {
        log.info("[UjianMapel] Update attempt for id={} by user: {}", id,
                SecurityContextHolder.getContext().getAuthentication().getName());
        try {
            return ResponseEntity.ok(ujianMapelService.updateUjianMapel(id, dto));
        } catch (Exception e) {
            log.error("[UjianMapel] UPDATE ERROR for id={}: ", id, e);
            java.util.Map<String, String> errMap = new java.util.HashMap<>();
            errMap.put("message", e.getMessage() != null ? e.getMessage() : "Unknown internal error");
            errMap.put("error", e.getClass().getName());
            return ResponseEntity.status(500).body(errMap);
        }
    }

    @PutMapping("/{id}/toggle-nilai")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<UjianMapelDTO> toggleNilai(@PathVariable Long id) {
        log.info("[UjianMapel] Toggle Nilai attempt for id={} by user: {}", id,
                SecurityContextHolder.getContext().getAuthentication().getName());
        return ResponseEntity.ok(ujianMapelService.toggleTampilkanNilai(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        log.info("[UjianMapel] Delete attempt for id={} by user: {}", id,
                SecurityContextHolder.getContext().getAuthentication().getName());
        ujianMapelService.deleteUjian(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/validate-token")
    @PreAuthorize("hasAnyRole('SISWA')")
    public ResponseEntity<?> validateToken(@PathVariable Long id, @RequestParam String ujianToken,
            @RequestParam(required = false) String deviceId,
            Authentication authentication) {
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        try {
            if (deviceId != null && !deviceId.isEmpty()) {
                examStatusService.checkAndLockDevice(id, userDetails.getUsername(), deviceId);
            }
            return ResponseEntity.ok(ujianMapelService.validateToken(id, ujianToken, userDetails.getId()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).body(e.getMessage());
        }
    }

    @PostMapping("/{id}/refresh-token")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<UjianMapelDTO> refreshToken(@PathVariable Long id) {
        return ResponseEntity.ok(ujianMapelService.refreshToken(id));
    }

    @PostMapping("/{id}/keep-alive")
    @PreAuthorize("hasRole('SISWA')")
    public ResponseEntity<Void> keepAlive(@PathVariable Long id, @RequestParam String nisn, @RequestParam String nama,
            @RequestParam(required = false) Long ruangId) {
        examStatusService.markAsActive(id, nisn, nama, ruangId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/online-students")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<java.util.Set<String>> getOnlineStudents(@PathVariable Long id,
            @RequestParam(required = false) Long ruangId) {
        return ResponseEntity.ok(examStatusService.getActiveStudents(id, ruangId));
    }

    @PostMapping("/{id}/finish")
    @PreAuthorize("hasRole('SISWA')")
    public ResponseEntity<Void> finishUjian(@PathVariable Long id, Authentication authentication) {
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        ujianMapelService.markUjianAsFinished(id, userDetails.getId());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/monitoring")
    @PreAuthorize("hasAnyRole('TU', 'GURU', 'ADMIN')")
    public ResponseEntity<List<com.baknusbelajar.api.dto.exam.ExamMonitoringDTO>> getExamMonitoring(
            @PathVariable Long id) {
        java.util.Set<String> onlineStudents = examStatusService.getActiveStudents(id, null);
        return ResponseEntity.ok(ujianMapelService.getExamMonitoring(id, onlineStudents));
    }

    @GetMapping("/event/{eventId}/monitoring")
    @PreAuthorize("hasAnyRole('TU', 'GURU', 'ADMIN')")
    public ResponseEntity<List<com.baknusbelajar.api.dto.exam.ExamMonitoringDTO>> getEventMonitoring(
            @PathVariable Long eventId) {
        List<UjianMapelDTO> exams = ujianMapelService.getUjianByEvent(eventId);
        List<com.baknusbelajar.api.dto.exam.ExamMonitoringDTO> all = new java.util.ArrayList<>();
        for (UjianMapelDTO ex : exams) {
            java.util.Set<String> onlineStudents = examStatusService.getActiveStudents(ex.getId(), null);
            all.addAll(ujianMapelService.getExamMonitoring(ex.getId(), onlineStudents));
        }
        return ResponseEntity.ok(all);
    }

    @PostMapping("/{id}/reset-peserta")
    @PreAuthorize("hasAnyRole('TU', 'GURU', 'ADMIN')")
    public ResponseEntity<Void> resetPeserta(@PathVariable Long id, @RequestParam String nisn) {
        examStatusService.resetPeserta(id, nisn);
        // Also remove from presence list just to be safe so they appear offline
        examStatusService.removeStudent(id, nisn, "");
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/reset-siswa/{siswaId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<String> resetUjianSiswa(@PathVariable Long id, @PathVariable Long siswaId) {
        ujianMapelService.resetUjianForStudent(id, siswaId);
        return ResponseEntity.ok("Ujian berhasil direset untuk siswa tersebut. Siswa sekarang dapat mengulang ujian.");
    }

    @PostMapping("/{id}/reset-all")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<String> resetUjianAll(@PathVariable Long id) {
        ujianMapelService.resetUjianForAllStudents(id);
        return ResponseEntity.ok("Ujian berhasil direset untuk seluruh siswa.");
    }

    @GetMapping("/{id}/summary")
    @PreAuthorize("hasAnyRole('TU', 'GURU', 'ADMIN')")
    public ResponseEntity<com.baknusbelajar.api.dto.exam.ExamClassSummaryDTO> getExamClassSummary(
            @PathVariable Long id) {
        return ResponseEntity.ok(ujianMapelService.getExamClassSummary(id));
    }


    @PostMapping("/{targetId}/copy-from/{sourceId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<?> copyQuestions(
            @PathVariable Long targetId,
            @PathVariable Long sourceId) {
        log.info("[UjianMapel] Copy questions request from sourceId={} to targetId={}", sourceId, targetId);
        try {
            return ResponseEntity.ok(ujianMapelService.copyQuestions(targetId, sourceId));
        } catch (Exception e) {
            log.error("[UjianMapel] Error copying questions: ", e);
            java.util.Map<String, String> err = new java.util.HashMap<>();
            err.put("message", e.getMessage() != null ? e.getMessage() : "Gagal menyalin soal");
            return ResponseEntity.badRequest().body(err);
        }
    }

    @GetMapping("/{ujianId}/peserta")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<List<ExamPesertaDTO>> getPesertaUjian(
            @PathVariable Long ujianId,
            @RequestParam(required = false) Long kelasId,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ujianMapelService.getPesertaUjian(ujianId, kelasId, status));
    }
}
