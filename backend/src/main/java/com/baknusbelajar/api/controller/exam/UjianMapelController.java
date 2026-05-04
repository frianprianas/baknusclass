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
    public ResponseEntity<UjianMapelDTO> create(@RequestBody UjianMapelDTO dto) {
        log.info("[UjianMapel] Create attempt by user: {} with authorities: {}",
                SecurityContextHolder.getContext().getAuthentication().getName(),
                SecurityContextHolder.getContext().getAuthentication().getAuthorities());
        return ResponseEntity.ok(ujianMapelService.createUjianMapel(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<UjianMapelDTO> update(@PathVariable Long id, @RequestBody UjianMapelDTO dto) {
        log.info("[UjianMapel] Update attempt for id={} by user: {}", id,
                SecurityContextHolder.getContext().getAuthentication().getName());
        return ResponseEntity.ok(ujianMapelService.updateUjianMapel(id, dto));
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

    @PostMapping("/{id}/reset-peserta")
    @PreAuthorize("hasAnyRole('TU', 'GURU', 'ADMIN')")
    public ResponseEntity<Void> resetPeserta(@PathVariable Long id, @RequestParam String nisn) {
        examStatusService.resetPeserta(id, nisn);
        // Also remove from presence list just to be safe so they appear offline
        examStatusService.removeStudent(id, nisn, "");
        return ResponseEntity.ok().build();
    }
}
