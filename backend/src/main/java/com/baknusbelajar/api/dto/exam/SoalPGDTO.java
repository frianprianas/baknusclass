package com.baknusbelajar.api.dto.exam;

import lombok.Data;

import java.io.Serializable;

@Data
public class SoalPGDTO implements Serializable {
    private Long id;
    private Long ujianId;
    private String pertanyaan;
    private String pilihanA;
    private String pilihanB;
    private String pilihanC;
    private String pilihanD;
    private String pilihanE;
    private String kunciJawaban;
    private Double bobotNilai;
}
