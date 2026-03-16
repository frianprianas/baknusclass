package com.baknusbelajar.api.controller.materi;

import com.baknusbelajar.api.dto.materi.MateriDTO;
import com.baknusbelajar.api.service.MateriService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/materi")
@RequiredArgsConstructor
public class MateriController {

    private final MateriService materiService;

    @GetMapping("/my")
    @PreAuthorize("hasRole('GURU')")
    public ResponseEntity<List<MateriDTO>> getMyMateri(Authentication auth) {
        return ResponseEntity.ok(materiService.getMyMateri(auth.getName()));
    }

    @GetMapping("/student/my")
    @PreAuthorize("hasRole('SISWA')")
    public ResponseEntity<List<MateriDTO>> getStudentMateri(Authentication auth) {
        return ResponseEntity.ok(materiService.getMaterialsForStudent(auth.getName()));
    }

    @PostMapping("/{id}/log-view")
    @PreAuthorize("hasRole('SISWA')")
    public ResponseEntity<Void> logView(@PathVariable Long id, Authentication auth) {
        materiService.logMateriView(id, auth.getName());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/teacher/notifications")
    @PreAuthorize("hasRole('GURU')")
    public ResponseEntity<List<com.baknusbelajar.api.dto.materi.MateriViewLogDTO>> getTeacherNotifications(
            Authentication auth) {
        return ResponseEntity.ok(materiService.getTeacherNotifications(auth.getName()));
    }

    @GetMapping("/assignment/{id}")
    @PreAuthorize("hasAnyRole('GURU', 'TU', 'ADMIN')")
    public ResponseEntity<List<MateriDTO>> getByAssignment(@PathVariable Long id) {
        return ResponseEntity.ok(materiService.getMateriByAssignment(id));
    }

    @PostMapping("/upload")
    @PreAuthorize("hasRole('GURU')")
    public ResponseEntity<MateriDTO> upload(
            @RequestParam("guruMapelId") Long guruMapelId,
            @RequestParam(value = "babId", required = false) Long babId,
            @RequestParam("namaMateri") String namaMateri,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(materiService.uploadMateri(guruMapelId, babId, namaMateri, file));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('GURU')")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication auth) {
        materiService.deleteMateri(id, auth.getName());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/view/{id}")
    public ResponseEntity<byte[]> viewMateri(@PathVariable Long id) {
        return materiService.proxyDownload(id);
    }
}
