package com.baknusbelajar.api.controller.enrollment;

import com.baknusbelajar.api.dto.enrollment.GuruMapelDTO;
import com.baknusbelajar.api.service.GuruMapelService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/enrollment/guru-mapel")
@RequiredArgsConstructor
public class GuruMapelController {

    private final GuruMapelService guruMapelService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<List<GuruMapelDTO>> getAll() {
        return ResponseEntity.ok(guruMapelService.getAllGuruMapel());
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('GURU')")
    public ResponseEntity<List<GuruMapelDTO>> getMyAssignments(Authentication auth) {
        return ResponseEntity.ok(guruMapelService.getMapelByEmail(auth.getName()));
    }

    @GetMapping("/guru/{guruId}")
    @PreAuthorize("hasAnyRole('TU', 'GURU')")
    public ResponseEntity<List<GuruMapelDTO>> getByGuru(@PathVariable Long guruId) {
        return ResponseEntity.ok(guruMapelService.getMapelByGuruId(guruId));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('TU')")
    public ResponseEntity<GuruMapelDTO> create(@RequestBody GuruMapelDTO dto) {
        return ResponseEntity.ok(guruMapelService.createGuruMapel(dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('TU')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        guruMapelService.deleteGuruMapel(id);
        return ResponseEntity.ok().build();
    }
}
