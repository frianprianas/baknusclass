package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "tb_bab_question")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BabQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bab_id", nullable = false)
    private Bab bab;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "siswa_id", nullable = false)
    private Siswa siswa;

    @Column(name = "pertanyaan", columnDefinition = "CLOB", nullable = false)
    private String pertanyaan;

    @Column(name = "jawaban", columnDefinition = "CLOB")
    private String jawaban;

    @Column(name = "asked_at")
    private LocalDateTime askedAt;

    @Column(name = "answered_at")
    private LocalDateTime answeredAt;

    @PrePersist
    protected void onCreate() {
        askedAt = LocalDateTime.now();
    }
}
