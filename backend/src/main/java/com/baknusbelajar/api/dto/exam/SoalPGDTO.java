package com.baknusbelajar.api.dto.exam;

import lombok.Data;
import java.io.Serializable;

@Data
public class SoalPGDTO implements Serializable {
    private Long id;
    private Long ujianId;
    private Long ujianMapelId;
    private String pertanyaan;
    private String pilihanA;
    private String pilihanB;
    private String pilihanC;
    private String pilihanD;
    private String pilihanE;
    private String kunciJawaban;
    private Double bobotNilai;
    private String tipeSoal; // "PG_BIASA", "PG_KOMPLEKS", "BENAR_SALAH", "BS_MAJEMUK"

    public Long getUjianId() {
        return ujianId != null ? ujianId : ujianMapelId;
    }

    public void setUjianId(Long ujianId) {
        this.ujianId = ujianId;
        if (this.ujianMapelId == null) {
            this.ujianMapelId = ujianId;
        }
    }

    public Long getUjianMapelId() {
        return ujianMapelId != null ? ujianMapelId : ujianId;
    }

    public void setUjianMapelId(Long ujianMapelId) {
        this.ujianMapelId = ujianMapelId;
        if (this.ujianId == null) {
            this.ujianId = ujianMapelId;
        }
    }
}
