package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tb_soal_pg")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SoalPG {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ujian_mapel_id", nullable = false)
    private UjianMapel ujianMapel;

    @Lob
    @Column(nullable = false)
    private String pertanyaan;

    @Column(name = "pilihan_a", nullable = false)
    private String pilihanA;

    @Column(name = "pilihan_b", nullable = false)
    private String pilihanB;

    @Column(name = "pilihan_c")
    private String pilihanC;

    @Column(name = "pilihan_d")
    private String pilihanD;

    @Column(name = "pilihan_e")
    private String pilihanE;

    @Column(name = "kunci_jawaban", nullable = false, length = 50)
    private String kunciJawaban; // e.g. "A", "A,C", "B"

    @Column(name = "bobot_nilai", nullable = false)
    private Double bobotNilai;

    @Column(name = "tipe_soal", length = 20)
    @Builder.Default
    private String tipeSoal = "PG_BIASA"; // PG_BIASA, PG_KOMPLEKS, BENAR_SALAH
}
