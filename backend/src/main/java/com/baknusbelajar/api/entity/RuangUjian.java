package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tb_ruang_ujian")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RuangUjian {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nama_ruang", nullable = false, length = 50)
    private String namaRuang; // e.g., "Ruang 1", "Ruang 2"

    @Column(length = 255)
    private String deskripsi;
}
