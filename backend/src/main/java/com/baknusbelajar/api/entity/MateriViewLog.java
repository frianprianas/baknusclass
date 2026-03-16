package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "tb_materi_view_log")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MateriViewLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "materi_id", nullable = false)
    private Materi materi;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "siswa_id", nullable = false)
    private Siswa siswa;

    @Column(name = "view_at")
    private LocalDateTime viewAt;

    @PrePersist
    protected void onCreate() {
        viewAt = LocalDateTime.now();
    }
}
