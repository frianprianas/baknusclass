package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "tb_tugas_guru")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TugasGuru {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guru_mapel_id", nullable = false)
    private GuruMapel guruMapel;

    @Column(name = "judul_tugas", nullable = false)
    private String judulTugas;

    @Column(name = "deskripsi", columnDefinition = "TEXT")
    private String deskripsi;

    @Column(name = "batas_waktu")
    private LocalDateTime batasWaktu;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
