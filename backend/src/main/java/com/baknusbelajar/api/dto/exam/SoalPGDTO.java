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
    private Integer urutan;

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

    // Aliases for compatibility with various question channels
    public String getOpsiA() { return pilihanA; }
    public void setOpsiA(String opsiA) { this.pilihanA = opsiA; }

    public String getOpsiB() { return pilihanB; }
    public void setOpsiB(String opsiB) { this.pilihanB = opsiB; }

    public String getOpsiC() { return pilihanC; }
    public void setOpsiC(String opsiC) { this.pilihanC = opsiC; }

    public String getOpsiD() { return pilihanD; }
    public void setOpsiD(String opsiD) { this.pilihanD = opsiD; }

    public String getOpsiE() { return pilihanE; }
    public void setOpsiE(String opsiE) { this.pilihanE = opsiE; }
}
