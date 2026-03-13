package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Entity
@Table(name = "tb_event_ujian")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventUjian {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nama_event", nullable = false)
    private String namaEvent; // e.g., "UTS Ganjil 2026"

    @Column(nullable = false, length = 20)
    private String semester;

    @Column(name = "tahun_ajaran", nullable = false, length = 20)
    private String tahunAjaran;

    @Column(name = "tanggal_mulai")
    private LocalDate tanggalMulai;

    @Column(name = "tanggal_selesai")
    private LocalDate tanggalSelesai;

    @Column(name = "status_aktif", nullable = false)
    @Builder.Default
    private Boolean statusAktif = true;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "tb_event_proktor", joinColumns = @JoinColumn(name = "event_id"), inverseJoinColumns = @JoinColumn(name = "guru_id"))
    @Builder.Default
    private java.util.Set<Guru> proktors = new java.util.HashSet<>();
}
