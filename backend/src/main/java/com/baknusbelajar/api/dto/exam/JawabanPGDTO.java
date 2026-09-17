package com.baknusbelajar.api.dto.exam;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class JawabanPGDTO {
    private Long id;

    @JsonProperty("soalPGId")
    @JsonAlias({"soalId", "soalPGId", "soal_pg_id"})
    private Long soalPGId;

    private Long siswaId;
    private String namaSiswa;
    private String nisn;
    private String namaKelas;

    @JsonProperty("jawaban")
    @JsonAlias({"jawaban", "jawabanDipilih", "jawaban_dipilih"})
    private String jawaban; // "A" or "A,C" or "B"

    private Boolean raguRagu;
    private Double skor;
    private Boolean isCorrect;
    private String kunciJawaban; // for teacher grading view
    private Double bobotNilai;
    private String tipeSoal;

    private LocalDateTime waktuMulaiUjian;
    private LocalDateTime waktuSelesaiUjian;
    private Boolean statusSelesaiUjian;

    // Getter dan setter kompatibilitas untuk frontend
    @JsonProperty("soalId")
    public Long getSoalId() {
        return this.soalPGId;
    }

    public void setSoalId(Long soalId) {
        if (this.soalPGId == null) {
            this.soalPGId = soalId;
        }
    }

    @JsonProperty("jawabanDipilih")
    public String getJawabanDipilih() {
        return this.jawaban;
    }

    public void setJawabanDipilih(String jawabanDipilih) {
        if (this.jawaban == null) {
            this.jawaban = jawabanDipilih;
        }
    }
}
