package com.baknusbelajar.api.dto.exam;

import lombok.Data;

@Data
public class KartuSoalRequest {
    private Long ujianMapelId;
    private Long soalEssayId; // Optional: if set, will update existing SoalEssay instead of creating new
    private String judul;
    private String tujuanPembelajaran;
    private String kriteriaKetercapaian;
    private String petunjukAssesment; // Will be mapped to Pertanyaan
    private String kunciJawaban; // Will be mapped to Kunci Jawaban
    private Double bobotNilai;
    private Integer nomorSoal;
}
