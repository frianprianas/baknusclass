package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tb_siswa_mapel")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SiswaMapel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "siswa_id", nullable = false)
    private Siswa siswa;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mapel_id", nullable = false)
    private Mapel mapel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ruang_id")
    private RuangUjian ruangUjian;
}
