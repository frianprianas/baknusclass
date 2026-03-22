package com.baknusbelajar.api.controller.exam;

import com.baknusbelajar.api.service.AiSaranQueueService;
import com.baknusbelajar.api.security.CustomUserDetails;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/exam/saran-nilai")
@RequiredArgsConstructor
public class SaranNilaiController {

    private final AiSaranQueueService aiSaranQueueService;

    /** One student answer item for a single question. */
    @Data
    public static class ItemJawaban {
        private String soal;
        private String jawabSiswa;
        private Double skor;
        private Double bobotMaksimal;
    }

    /** One subject's exam result with full Q&A detail. */
    @Data
    public static class HasilMapel {
        private String namaMapel;
        private Double nilaiAkhir;
        private List<ItemJawaban> daftarJawaban;
    }

    @Data
    public static class SaranNilaiRequest {
        private String namaSiswa;
        private List<HasilMapel> hasilPerMapel;
    }

    @PostMapping("/generate")
    @PreAuthorize("hasRole('SISWA')")
    public ResponseEntity<String> generate(@RequestBody SaranNilaiRequest req,
            Authentication authentication) {
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        String siswaId = String.valueOf(userDetails.getId());

        log.info("[SaranNilai] Queue request from siswaId={} ({})", siswaId, req.getNamaSiswa());
        try {
            String saran = aiSaranQueueService.getSaranWithQueue(
                    siswaId, req.getNamaSiswa(), req.getHasilPerMapel());
            return ResponseEntity.ok(saran);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResponseEntity.status(503).body("Permintaan dibatalkan. Silakan coba lagi.");
        } catch (Exception e) {
            log.error("[SaranNilai] Error: {}", e.getMessage());
            return ResponseEntity.status(503).body("AI tidak tersedia saat ini, coba lagi nanti.");
        }
    }
}
