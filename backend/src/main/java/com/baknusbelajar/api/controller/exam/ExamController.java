package com.baknusbelajar.api.controller.exam;

import com.baknusbelajar.api.service.BaknusDriveService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/exam")
public class ExamController {

    @Autowired
    private BaknusDriveService driveService;

    @Autowired
    private com.baknusbelajar.api.service.KartuSoalService kartuSoalService;

    // Dipanggil saat Admin buat Event
    @PostMapping("/create")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public String createExam(@RequestParam String eventName) {
        return driveService.createEventFolder(eventName);
    }

    // Alias for backward compatibility if needed, or just use /create
    @PostMapping("/create-event")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public String createEvent(@RequestParam String eventName) {
        return driveService.createEventFolder(eventName);
    }

    // Dipanggil saat Guru upload soal
    @PostMapping("/upload-soal")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public String uploadSoal(
            @RequestParam String eventName,
            @RequestParam String subjectName,
            @RequestParam("file") MultipartFile file) {
        return driveService.uploadSoal(eventName, subjectName, file);
    }

    @PostMapping("/create-kartu-soal")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public String createKartuSoal(@RequestBody com.baknusbelajar.api.dto.exam.KartuSoalRequest request) {
        return kartuSoalService.createKartuSoal(request);
    }

    @PostMapping("/upload-image")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public org.springframework.http.ResponseEntity<?> uploadExamImage(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return org.springframework.http.ResponseEntity.badRequest().body("File tidak boleh kosong");
        }
        try {
            String originalName = file.getOriginalFilename();
            String ext = "";
            if (originalName != null && originalName.contains(".")) {
                ext = originalName.substring(originalName.lastIndexOf(".")).toLowerCase();
            }
            if (ext.isEmpty()) ext = ".jpg";

            String fileName = "exam_" + java.util.UUID.randomUUID().toString().replace("-", "") + ext;
            java.nio.file.Path uploadDir = java.nio.file.Paths.get("uploads", "exam-images");
            if (!java.nio.file.Files.exists(uploadDir)) {
                java.nio.file.Files.createDirectories(uploadDir);
            }
            java.nio.file.Path targetPath = uploadDir.resolve(fileName);
            java.nio.file.Files.copy(file.getInputStream(), targetPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);

            java.util.Map<String, String> response = new java.util.HashMap<>();
            response.put("url", "/api/exam/images/" + fileName);
            response.put("fileName", fileName);
            return org.springframework.http.ResponseEntity.ok(response);
        } catch (Exception e) {
            return org.springframework.http.ResponseEntity.status(500).body("Gagal upload gambar: " + e.getMessage());
        }
    }

    @GetMapping("/images/{fileName:.+}")
    public org.springframework.http.ResponseEntity<?> getExamImage(@PathVariable String fileName) {
        try {
            java.nio.file.Path filePath = java.nio.file.Paths.get("uploads", "exam-images").resolve(fileName).normalize();
            if (!java.nio.file.Files.exists(filePath)) {
                return org.springframework.http.ResponseEntity.notFound().build();
            }
            org.springframework.core.io.Resource resource = new org.springframework.core.io.UrlResource(filePath.toUri());
            String contentType = java.nio.file.Files.probeContentType(filePath);
            if (contentType == null) {
                contentType = "application/octet-stream";
            }
            return org.springframework.http.ResponseEntity.ok()
                    .contentType(org.springframework.http.MediaType.parseMediaType(contentType))
                    .header(org.springframework.http.HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                    .body(resource);
        } catch (Exception e) {
            return org.springframework.http.ResponseEntity.status(500).build();
        }
    }
}
