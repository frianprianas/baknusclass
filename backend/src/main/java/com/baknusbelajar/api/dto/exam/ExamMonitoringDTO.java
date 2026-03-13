package com.baknusbelajar.api.dto.exam;

import lombok.Data;

@Data
public class ExamMonitoringDTO {
    private Long siswaId;
    private String nisn;
    private String namaSiswa;
    private Boolean isOnline;
    private Boolean isFinished;
}
