package com.baknusbelajar.api.dto.exam;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ExamMonitoringDTO {
    private Long siswaId;
    private String nisn;
    private String namaSiswa;
    private Long kelasId;
    private String namaKelas;
    private Long ujianId;
    private String namaMapel;
    private Boolean isOnline;
    private Boolean isFinished;
    private LocalDateTime waktuMulai;
    private LocalDateTime waktuSelesai;
    private Long sisaWaktuDetik;
    private String statusText; // "BELUM_MULAI", "SEDANG_MENGERJAKAN", "SELESAI"
}
