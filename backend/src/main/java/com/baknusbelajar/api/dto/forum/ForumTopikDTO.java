package com.baknusbelajar.api.dto.forum;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ForumTopikDTO {
    private Long id;
    private String judul;
    private String konten;
    @com.fasterxml.jackson.annotation.JsonProperty("isPinned")
    private Boolean isPinned;
    @com.fasterxml.jackson.annotation.JsonProperty("isClosed")
    private Boolean isClosed;
    private Long guruMapelId;
    @com.fasterxml.jackson.annotation.JsonProperty("isGuruOnly")
    private Boolean isGuruOnly;
    private Long creatorUserId;
    private String namaGuru;

    private String namaGuruEmail;
    private String namaMapel;
    private String namaKelas;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long jumlahKomentar;
}
