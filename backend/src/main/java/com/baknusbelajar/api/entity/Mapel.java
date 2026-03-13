package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tb_mapel")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Mapel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kode_mapel", unique = true, nullable = false, length = 20)
    private String kodeMapel;

    @Column(name = "nama_mapel", nullable = false)
    private String namaMapel;
}
