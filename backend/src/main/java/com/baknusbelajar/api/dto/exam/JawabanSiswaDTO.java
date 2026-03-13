package com.baknusbelajar.api.dto.exam;

import lombok.Data;

@Data
public class JawabanSiswaDTO {
    private Long id;
    private Long soalId;
    private Long siswaId;
    private String namaSiswa;
    private String nisn; // Useful for grouping
    private String namaKelas;
    private String teksJawaban;
    private Double skorAi;
    private String alasanAi;
    private Double skorFinalGuru;
    private Boolean raguRagu;
    private java.time.LocalDateTime waktuMulaiUjian;
    private java.time.LocalDateTime waktuSelesaiUjian;
    private Boolean statusSelesaiUjian;
}
