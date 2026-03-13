package com.baknusbelajar.api.dto.enrollment;

import lombok.Data;

@Data
public class GuruMapelDTO {
    private Long id;
    private Long guruId;
    private String namaGuru; // Useful for read responses
    private Long mapelId;
    private String namaMapel; // Useful for read responses
    private Long kelasId;
    private String namaKelas; // Useful for read responses
}
