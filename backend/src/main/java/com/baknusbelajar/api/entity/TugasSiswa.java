package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "tb_tugas_siswa")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TugasSiswa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "siswa_id", nullable = false)
    private Siswa siswa;

    @Column(name = "teacher_email", nullable = false)
    private String teacherEmail;

    @Column(name = "subject_name", nullable = false)
    private String subjectName;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "drive_link", nullable = false, length = 512)
    private String driveLink;

    @Column(name = "submitted_at")
    @Builder.Default
    private LocalDateTime submittedAt = LocalDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bab_id")
    private Bab bab;
}
