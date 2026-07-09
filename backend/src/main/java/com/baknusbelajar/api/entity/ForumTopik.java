package com.baknusbelajar.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "tb_forum_topik")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ForumTopik {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String judul;

    @Column(name = "is_pinned")
    @Builder.Default
    private Boolean pinned = false;

    @Column(columnDefinition = "NUMBER(1) DEFAULT 0")
    private Boolean closed;

    @Column(columnDefinition = "CLOB")
    private String konten;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guru_mapel_id")
    private GuruMapel guruMapel;

    @Column(name = "is_guru_only", nullable = false)
    @Builder.Default
    private Boolean isGuruOnly = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creator_user_id")
    private Users creator;



    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(columnDefinition = "CLOB")
    private String aiAnalysis;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
