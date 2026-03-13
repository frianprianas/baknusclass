package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tb_jawaban_siswa")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JawabanSiswa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "soal_id", nullable = false)
    private SoalEssay soalEssay;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "siswa_id", nullable = false)
    private Siswa siswa;

    @Lob
    @Column(name = "teks_jawaban", nullable = false)
    private String teksJawaban;

    @Column(name = "skor_ai")
    private Double skorAi;

    @Lob
    @Column(name = "alasan_ai")
    private String alasanAi;

    @Column(name = "skor_final_guru")
    private Double skorFinalGuru;

    @Column(name = "ragu_ragu")
    @Builder.Default
    private Boolean raguRagu = false;
}
