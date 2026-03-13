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
}
