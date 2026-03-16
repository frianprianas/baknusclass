package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "tb_materi")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Materi {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nama_materi", nullable = false)
    private String namaMateri;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "file_type")
    private String fileType;

    @Column(name = "drive_link", length = 500)
    private String driveLink;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guru_mapel_id", nullable = false)
    private GuruMapel guruMapel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bab_id")
    private Bab bab;

    @Column(name = "uploaded_at")
    private LocalDateTime uploadedAt;

    @PrePersist
    protected void onCreate() {
        uploadedAt = LocalDateTime.now();
    }
}
