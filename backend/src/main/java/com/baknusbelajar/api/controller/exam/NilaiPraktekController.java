package com.baknusbelajar.api.controller.exam;

import com.baknusbelajar.api.dto.exam.NilaiPraktekDTO;
import com.baknusbelajar.api.service.NilaiPraktekService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exam/nilai-praktek")
@RequiredArgsConstructor
public class NilaiPraktekController {

    private final NilaiPraktekService nilaiPraktekService;

    @GetMapping("/{ujianMapelId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public List<NilaiPraktekDTO> getByUjian(@PathVariable Long ujianMapelId) {
        return nilaiPraktekService.getNilaiByUjian(ujianMapelId);
    }

    @PostMapping("/save")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU', 'GURU')")
    public String saveBatch(@RequestBody List<NilaiPraktekDTO> dtos) {
        nilaiPraktekService.saveNilaiBatch(dtos);
        return "Nilai Praktek Berhasil Disimpan & Sinkron ke Drive";
    }
}
