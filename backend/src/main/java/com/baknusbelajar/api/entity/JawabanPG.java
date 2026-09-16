package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tb_jawaban_pg")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JawabanPG {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "soal_pg_id", nullable = false)
    private SoalPG soalPG;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "siswa_id", nullable = false)
    private Siswa siswa;

    @Column(name = "jawaban", length = 50)
    private String jawaban; // "A" or "A,C" or "B"

    @Column(name = "ragu_ragu")
    @Builder.Default
    private Boolean raguRagu = false;

    @Column(name = "skor")
    private Double skor;

    @Column(name = "is_correct")
    private Boolean isCorrect;
}
