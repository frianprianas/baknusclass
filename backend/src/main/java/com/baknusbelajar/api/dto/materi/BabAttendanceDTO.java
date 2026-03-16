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
public class BabAttendanceDTO {
    private Long id;
    private Long babId;
    private Long siswaId;
    private String namaSiswa;
    private String kelas;
    private LocalDateTime attendedAt;
}
