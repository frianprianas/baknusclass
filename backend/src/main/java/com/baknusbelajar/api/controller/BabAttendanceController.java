package com.baknusbelajar.api.controller;

import com.baknusbelajar.api.dto.materi.BabAttendanceDTO;
import com.baknusbelajar.api.service.BabAttendanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bab-attendance")
@RequiredArgsConstructor
public class BabAttendanceController {

    private final BabAttendanceService attendanceService;

    @PostMapping("/{babId}/attend")
    public ResponseEntity<BabAttendanceDTO> markAttendance(
            @PathVariable Long babId) {
        return ResponseEntity.ok(attendanceService.markAttendance(babId));
    }

    @GetMapping("/{babId}")
    public ResponseEntity<List<BabAttendanceDTO>> getAttendance(@PathVariable Long babId) {
        return ResponseEntity.ok(attendanceService.getAttendanceByBab(babId));
    }

    @GetMapping("/{babId}/check")
    public ResponseEntity<Boolean> checkAttendance(@PathVariable Long babId) {
        return ResponseEntity.ok(attendanceService.hasStudentAttended(babId));
    }

    @PostMapping("/{babId}/sync")
    public ResponseEntity<String> syncToDrive(@PathVariable Long babId) {
        attendanceService.syncAttendanceToDrive(babId);
        return ResponseEntity.ok("Synced successfully to BaknusDrive");
    }
}
