package com.baknusbelajar.api.dto.exam;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DraftSoalDTO {
    private Integer nomor;
    private String tipeSoal; // PG_BIASA, PG_KOMPLEKS, BENAR_SALAH, BS_MAJEMUK, ESSAY
    private String pertanyaan;
    private String pilihanA;
    private String pilihanB;
    private String pilihanC;
    private String pilihanD;
    private String pilihanE;
    private String kunciJawaban;
    private Double bobotNilai;
}
