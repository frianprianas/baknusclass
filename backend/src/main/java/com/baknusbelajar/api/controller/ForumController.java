package com.baknusbelajar.api.controller;

import com.baknusbelajar.api.dto.forum.ForumKomentarDTO;
import com.baknusbelajar.api.dto.forum.ForumTopikDTO;
import com.baknusbelajar.api.service.ForumService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/forum")
@RequiredArgsConstructor
public class ForumController {

    private final ForumService forumService;

    @GetMapping("/topik/guru-mapel/{gmId}")
    public ResponseEntity<List<ForumTopikDTO>> getTopikByGuruMapel(@PathVariable Long gmId) {
        return ResponseEntity.ok(forumService.getTopikByGuruMapel(gmId));
    }

    @GetMapping("/topik/kelas/{kelasId}")
    public ResponseEntity<List<ForumTopikDTO>> getTopikByKelas(@PathVariable Long kelasId) {
        return ResponseEntity.ok(forumService.getTopikByKelas(kelasId));
    }

    @GetMapping("/topik/{id}")
    public ResponseEntity<ForumTopikDTO> getTopikById(@PathVariable Long id) {
        return ResponseEntity.ok(forumService.getTopikById(id));
    }

    @PostMapping("/topik")
    @PreAuthorize("hasAnyRole('ADMIN', 'GURU')")
    public ResponseEntity<ForumTopikDTO> createTopik(@RequestBody ForumTopikDTO dto) {
        return ResponseEntity.ok(forumService.createTopik(dto));
    }

    @DeleteMapping("/topik/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'GURU')")
    public ResponseEntity<Void> deleteTopik(@PathVariable Long id) {
        forumService.deleteTopik(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/topik/{id}/pin")
    @PreAuthorize("hasAnyRole('ADMIN', 'GURU')")
    public ResponseEntity<ForumTopikDTO> togglePin(@PathVariable Long id) {
        return ResponseEntity.ok(forumService.togglePin(id));
    }

    @PutMapping("/topik/{id}/close")
    @PreAuthorize("hasAnyRole('ADMIN', 'GURU')")
    public ResponseEntity<ForumTopikDTO> toggleClosed(@PathVariable Long id) {
        return ResponseEntity.ok(forumService.toggleClosed(id));
    }

    @GetMapping("/topik/{topikId}/komentar")
    public ResponseEntity<List<ForumKomentarDTO>> getKomentar(@PathVariable Long topikId) {
        return ResponseEntity.ok(forumService.getKomentarByTopik(topikId));
    }

    @PostMapping("/komentar")
    public ResponseEntity<ForumKomentarDTO> postKomentar(@RequestBody ForumKomentarDTO dto) {
        return ResponseEntity.ok(forumService.postKomentar(dto));
    }
}
