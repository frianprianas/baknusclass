package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tb_kelas")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Kelas {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 5)
    private String tingkat; // e.g. "X", "XI", "XII"

    @Column(name = "nama_kelas", nullable = false, length = 50)
    private String namaKelas; // e.g. "X RPL 1"

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "jurusan_id", nullable = false)
    private Jurusan jurusan;
}
