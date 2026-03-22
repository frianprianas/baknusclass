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
    @JoinColumn(name = "event_id", nullable = false)
    private EventUjian eventUjian;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guru_mapel_id", nullable = false)
    private GuruMapel guruMapel;

    @Column(name = "waktu_mulai", nullable = false)
    private LocalDateTime waktuMulai;

    @Column(name = "waktu_selesai", nullable = false)
    private LocalDateTime waktuSelesai;

    @Column(name = "durasi")
    private Integer durasi; // in minutes

    @Column(length = 6)
    private String token;

    @Column(name = "tampilkan_nilai")
    private Boolean tampilkanNilai = false;
}
