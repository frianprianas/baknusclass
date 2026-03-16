package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "tb_bab_attendance", uniqueConstraints = {
        @UniqueConstraint(columnNames = { "bab_id", "siswa_id" })
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BabAttendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bab_id", nullable = false)
    private Bab bab;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "siswa_id", nullable = false)
    private Siswa siswa;

    @Column(name = "attended_at", nullable = false)
    private LocalDateTime attendedAt;
}
