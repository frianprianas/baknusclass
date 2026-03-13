package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "STATUS_UJIAN_SISWA")
public class SiswaUjianStatus {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "siswa_id", nullable = false)
    private Siswa siswa;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ujian_mapel_id", nullable = false)
    private UjianMapel ujianMapel;

    @Column(name = "status_selesai")
    private Boolean statusSelesai = false;

    @Column(name = "waktu_mulai_siswa")
    private LocalDateTime waktuMulaiSiswa;

    @Column(name = "waktu_selesai")
    private LocalDateTime waktuSelesai;
}
