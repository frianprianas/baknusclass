package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "tb_ujian_mapel")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UjianMapel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id")
    private EventUjian eventUjian;


    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mapel_id")
    private Mapel mapel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guru_id")
    private Guru guru;

    @Enumerated(EnumType.STRING)
    @Column(name = "jenis_ujian", nullable = false)
    @Builder.Default
    private JenisUjian jenisUjian = JenisUjian.UJIAN_UTAMA;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pembuat_guru_id")
    private Guru pembuatGuru;


    @Column(name = "waktu_mulai", nullable = false)
    private LocalDateTime waktuMulai;

    @Column(name = "waktu_selesai", nullable = false)
    private LocalDateTime waktuSelesai;

    @Column(name = "durasi")
    private Integer durasi; // in minutes

    @Column(length = 6)
    private String token;

    @Column(name = "tampilkan_nilai")
    @Builder.Default
    private Boolean tampilkanNilai = false;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "tb_ujian_mapel_kelas",
        joinColumns = @JoinColumn(name = "ujian_mapel_id"),
        inverseJoinColumns = @JoinColumn(name = "kelas_id")
    )
    @Builder.Default
    private java.util.Set<Kelas> kelasList = new java.util.HashSet<>();
}
