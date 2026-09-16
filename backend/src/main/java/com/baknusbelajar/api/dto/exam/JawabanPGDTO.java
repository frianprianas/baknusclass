package com.baknusbelajar.api.dto.exam;

import lombok.Data;

@Data
public class JawabanPGDTO {
    private Long id;
    private Long soalPGId;
    private Long siswaId;
    private String jawaban; // "A" or "A,C" or "B"
    private Boolean raguRagu;
    private Double skor;
    private Boolean isCorrect;
    private String kunciJawaban; // for teacher grading view
    private Double bobotNilai;
    private String tipeSoal;
}
