package com.baknusbelajar.api.dto.materi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MateriDTO {
    private Long id;
    private String namaMateri;
    private String fileName;
    private String fileType;
    private String driveLink;
    private Long guruMapelId;
    private String namaMapel;
    private String namaKelas;
    private LocalDateTime uploadedAt;
    private Boolean isViewed; // New field for student dashboard
    private Long babId;
}
