package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tb_soal_essay")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SoalEssay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ujian_mapel_id", nullable = false)
    private UjianMapel ujianMapel;

    @Lob
    @Column(nullable = false)
    private String pertanyaan;

    @Lob
    @Column(name = "kunci_jawaban", nullable = false)
    private String kunciJawaban;

    @Column(name = "bobot_nilai", nullable = false)
    private Double bobotNilai;
}
