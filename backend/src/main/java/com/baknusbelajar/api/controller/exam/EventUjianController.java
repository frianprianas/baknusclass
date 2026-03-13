package com.baknusbelajar.api.controller.exam;

import com.baknusbelajar.api.service.EventUjianService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exam/event")
@RequiredArgsConstructor
public class EventUjianController {

    private final EventUjianService eventUjianService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU', 'SISWA')")
    public ResponseEntity<List<com.baknusbelajar.api.dto.exam.EventUjianDTO>> getAll() {
        return ResponseEntity.ok(eventUjianService.getAllEvent());
    }

    @GetMapping("/active")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU', 'SISWA')")
    public ResponseEntity<com.baknusbelajar.api.dto.exam.EventUjianDTO> getActive() {
        return ResponseEntity.ok(eventUjianService.getActiveEvent());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<com.baknusbelajar.api.dto.exam.EventUjianDTO> create(
            @RequestBody com.baknusbelajar.api.dto.exam.EventUjianDTO dto) {
        return ResponseEntity.ok(eventUjianService.createEvent(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<com.baknusbelajar.api.dto.exam.EventUjianDTO> update(@PathVariable Long id,
            @RequestBody com.baknusbelajar.api.dto.exam.EventUjianDTO dto) {
        return ResponseEntity.ok(eventUjianService.updateEvent(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<?> delete(@PathVariable Long id, @RequestParam(defaultValue = "false") boolean force) {
        try {
            eventUjianService.deleteEvent(id, force);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            if (e.getMessage().startsWith("CONTAINS_DATA|")) {
                return ResponseEntity.status(409).body(e.getMessage());
            }
            throw e;
        }
    }

    @PutMapping("/{id}/toggle-status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<com.baknusbelajar.api.dto.exam.EventUjianDTO> toggleStatus(@PathVariable Long id) {
        return ResponseEntity.ok(eventUjianService.toggleEventStatus(id));
    }

    @GetMapping("/delete-all")
    public ResponseEntity<Void> deleteAll() {
        eventUjianService.deleteAllEvents();
        return ResponseEntity.ok().build();
    }
}
