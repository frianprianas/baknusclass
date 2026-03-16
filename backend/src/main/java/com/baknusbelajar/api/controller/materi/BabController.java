package com.baknusbelajar.api.controller.materi;

import com.baknusbelajar.api.dto.materi.BabDTO;
import com.baknusbelajar.api.service.BabService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.security.core.Authentication;
import java.util.List;

@RestController
@RequestMapping("/api/bab")
@RequiredArgsConstructor
public class BabController {

    private final BabService babService;

    @GetMapping("/my")
    public ResponseEntity<List<BabDTO>> getStudentBab(Authentication auth) {
        return ResponseEntity.ok(babService.getBabForStudent(auth.getName()));
    }

    @GetMapping("/assignment/{assignmentId}")
    public ResponseEntity<List<BabDTO>> getBab(@PathVariable Long assignmentId) {
        return ResponseEntity.ok(babService.getBabByGuruMapel(assignmentId));
    }

    @PostMapping
    public ResponseEntity<BabDTO> createBab(@RequestBody BabDTO dto) {
        return ResponseEntity.ok(babService.createBab(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<BabDTO> updateBab(@PathVariable Long id, @RequestBody BabDTO dto) {
        return ResponseEntity.ok(babService.updateBab(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBab(@PathVariable Long id) {
        babService.deleteBab(id);
        return ResponseEntity.ok().build();
    }
}
