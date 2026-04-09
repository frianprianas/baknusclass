package com.baknusbelajar.api.controller.enrollment;

import com.baknusbelajar.api.dto.enrollment.SiswaMapelDTO;
import com.baknusbelajar.api.service.SiswaMapelService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/enrollment/siswa-mapel")
@RequiredArgsConstructor
public class SiswaMapelController {

    private final SiswaMapelService siswaMapelService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<List<SiswaMapelDTO>> getAll() {
        return ResponseEntity.ok(siswaMapelService.getAllSiswaMapel());
    }

    @GetMapping("/siswa/{siswaId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU', 'SISWA')")
    public ResponseEntity<List<SiswaMapelDTO>> getBySiswa(@PathVariable Long siswaId) {
        return ResponseEntity.ok(siswaMapelService.getMapelBySiswaId(siswaId));
    }

    /** Get all students enrolled in a specific mapel */
    @GetMapping("/mapel/{mapelId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public ResponseEntity<List<SiswaMapelDTO>> getByMapel(@PathVariable Long mapelId) {
        return ResponseEntity.ok(siswaMapelService.getEnrolledByMapelId(mapelId));
    }

    @GetMapping("/all-siswa")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<List<Map<String, Object>>> getAllSiswa() {
        return ResponseEntity.ok(siswaMapelService.getAllSiswaPlain());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<SiswaMapelDTO> create(@RequestBody SiswaMapelDTO dto) {
        return ResponseEntity.ok(siswaMapelService.createSiswaMapel(dto));
    }

    /**
     * Import all students from a kelas into a mapel.
     * Body: { "mapelId": 1, "kelasId": 5 }
     */
    @PostMapping("/import-kelas")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<Map<String, Object>> importByKelas(@RequestBody Map<String, Long> body) {
        Long mapelId = body.get("mapelId");
        Long kelasId = body.get("kelasId");
        if (mapelId == null || kelasId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "mapelId and kelasId are required"));
        }
        int count = siswaMapelService.importByKelas(mapelId, kelasId);
        return ResponseEntity.ok(Map.of(
                "message", count + " siswa berhasil diimport",
                "imported", count));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        siswaMapelService.deleteSiswaMapel(id);
        return ResponseEntity.ok().build();
    }
}
