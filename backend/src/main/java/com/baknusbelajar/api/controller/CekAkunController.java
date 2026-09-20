package com.baknusbelajar.api.controller;

import com.baknusbelajar.api.dto.user.CekAkunResponseDTO;
import com.baknusbelajar.api.service.CekAkunService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@RestController
@RequestMapping("/api/users/cek-akun")
@RequiredArgsConstructor
public class CekAkunController {

    private final CekAkunService cekAkunService;

    @GetMapping("/template")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<byte[]> downloadTemplate() {
        log.info("Downloading Cek Akun Excel template");
        byte[] excelBytes = cekAkunService.generateTemplate();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=template_cek_akun_siswa.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excelBytes);
    }

    @PostMapping(value = "/verify", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<CekAkunResponseDTO> verifyExcel(@RequestParam("file") MultipartFile file) {
        log.info("Verifying Cek Akun Excel file: {}, size: {} bytes",
                file != null ? file.getOriginalFilename() : "null",
                file != null ? file.getSize() : 0);
        return ResponseEntity.ok(cekAkunService.verifyExcel(file));
    }
}
