package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tb_bab")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Bab {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nama_bab", nullable = false)
    private String namaBab;

    @Column(name = "prolog", columnDefinition = "CLOB")
    private String prolog;

    @Column(name = "urutan")
    private Integer urutan;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guru_mapel_id", nullable = false)
    private GuruMapel guruMapel;
}
