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
public class ForumKomentarDTO {
    private Long id;
    private Long topikId;
    private Long userId;
    private String namaUser;
    private String roleUser;
    private String isiKomentar;
    private LocalDateTime createdAt;
}
