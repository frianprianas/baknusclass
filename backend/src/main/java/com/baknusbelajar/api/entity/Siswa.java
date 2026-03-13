package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tb_siswa")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Siswa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private Users user;

    @Column(unique = true, length = 20)
    private String nisn;

    @Column(name = "nama_lengkap", nullable = false)
    private String namaLengkap;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kelas_id")
    private Kelas kelas;
}
