package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tb_guru_mapel")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GuruMapel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guru_id", nullable = false)
    private Guru guru;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mapel_id", nullable = false)
    private Mapel mapel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kelas_id")
    private Kelas kelas;
}
