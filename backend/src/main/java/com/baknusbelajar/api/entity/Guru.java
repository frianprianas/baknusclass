package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tb_guru")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Guru {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private Users user;

    @Column(unique = true, length = 30)
    private String nip;

    @Column(name = "nama_lengkap", nullable = false)
    private String namaLengkap;

}
