package com.baknusbelajar.api.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class TugasGuruRequest {
    private Long guruMapelId;
    private String judulTugas;
    private String deskripsi;
    private LocalDateTime batasWaktu;
}
