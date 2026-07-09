package com.baknusbelajar.api.controller;

import com.baknusbelajar.api.dto.GradeTugasRequest;
import com.baknusbelajar.api.dto.TugasGuruRequest;
import com.baknusbelajar.api.entity.TugasGuru;
import com.baknusbelajar.api.entity.TugasSiswa;
import com.baknusbelajar.api.service.TugasGuruService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/guru/tugas")
@RequiredArgsConstructor
public class TugasGuruController {

    private final TugasGuruService tugasGuruService;

    @PostMapping
    public ResponseEntity<TugasGuru> createTugas(@RequestBody TugasGuruRequest request) {
        return ResponseEntity.ok(tugasGuruService.createTugas(request));
    }

    @GetMapping("/mapel/{guruMapelId}")
    public ResponseEntity<List<TugasGuru>> getTugasByGuruMapel(@PathVariable Long guruMapelId) {
        return ResponseEntity.ok(tugasGuruService.getTugasByGuruMapel(guruMapelId));
    }

    @PostMapping("/grade")
    public ResponseEntity<TugasSiswa> gradeTugas(@RequestBody GradeTugasRequest request) {
        return ResponseEntity.ok(tugasGuruService.gradeTugas(request));
    }
}
