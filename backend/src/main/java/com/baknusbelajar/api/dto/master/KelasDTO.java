package com.baknusbelajar.api.dto.master;

import lombok.Data;

@Data
public class KelasDTO {
    private Long id;
    private String tingkat;
    private String namaKelas;
    private Long jurusanId;
    private String namaJurusan; // Useful for read responses
}
