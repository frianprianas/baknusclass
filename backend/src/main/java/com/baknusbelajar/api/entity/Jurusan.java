package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tb_jurusan")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Jurusan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kode_jurusan", unique = true, nullable = false, length = 10)
    private String kodeJurusan;

    @Column(name = "nama_jurusan", nullable = false)
    private String namaJurusan;
}
