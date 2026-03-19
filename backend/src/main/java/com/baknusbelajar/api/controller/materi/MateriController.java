package com.baknusbelajar.api.controller.materi;

import com.baknusbelajar.api.dto.materi.MateriDTO;
import com.baknusbelajar.api.service.MateriService;
import com.baknusbelajar.api.service.BaknusDriveService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/materi")
@RequiredArgsConstructor
@Slf4j
public class MateriController {

    private final MateriService materiService;
    private final BaknusDriveService driveService;

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

    @PostMapping("/student/upload-tugas")
    @PreAuthorize("hasRole('SISWA')")
    public ResponseEntity<String> uploadTugas(
            @RequestParam("teacherEmail") String teacherEmail,
            @RequestParam("subjectName") String subjectName,
            @RequestParam(value = "babId", required = false) Long babId,
            @RequestParam("file") MultipartFile file,
            Authentication auth) {
        return ResponseEntity
                .ok(materiService.uploadTugasSiswa(auth.getName(), teacherEmail, subjectName, babId, file));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('GURU')")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication auth) {
        materiService.deleteMateri(id, auth.getName());
        return ResponseEntity.ok().build();
    }

    @GetMapping({ "/view/{id}", "/view/{id}/{fileName}" })
    public ResponseEntity<byte[]> viewMateri(
            @PathVariable Long id,
            @PathVariable(required = false) String fileName,
            @RequestParam(value = "download", defaultValue = "false") boolean isDownload,
            @RequestHeader(value = "User-Agent", required = false) String userAgent) {
        log.info(">>> View Request for ID: {}, name: {}, isDownload: {}, User-Agent: {}", id, fileName, isDownload,
                userAgent);
        return materiService.proxyDownload(id, isDownload);
    }

    @GetMapping("/view/collabora/{id}")
    public ResponseEntity<java.util.Map<String, String>> getCollaboraUrl(@PathVariable Long id) {
        com.baknusbelajar.api.entity.Materi materi = materiService.getMateriEntity(id);
        if (materi == null || materi.getDriveLink() == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        String driveLink = materi.getDriveLink();
        String driveFileId = driveLink.substring(driveLink.lastIndexOf("/") + 1);

        String viewerUrl = driveService.getCollaboraViewerUrl(driveFileId);
        if (viewerUrl != null) {
            return ResponseEntity.ok(java.util.Map.of("url", viewerUrl));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    @GetMapping("/student/submissions")
    @PreAuthorize("hasRole('GURU')")
    public ResponseEntity<List<com.baknusbelajar.api.dto.materi.TugasSiswaDTO>> getSubmissions(
            @RequestParam(value = "subjectName", required = false) String subjectName,
            Authentication auth) {
        return ResponseEntity.ok(materiService.getStudentSubmissions(auth.getName(), subjectName));
    }

    @GetMapping("/student/my-submissions")
    @PreAuthorize("hasRole('SISWA')")
    public ResponseEntity<List<com.baknusbelajar.api.dto.materi.TugasSiswaDTO>> getMySubmissions(Authentication auth) {
        log.info("API Request: getMySubmissions for user: {}", auth.getName());
        return ResponseEntity.ok(materiService.getStudentSubmissionsBySiswa(auth.getName()));
    }
}
