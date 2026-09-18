package com.baknusbelajar.api.dto.exam;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamPesertaDTO {
    private Long siswaId;
    private String nama;
    private String nisn;
    private Long kelasId;
    private String namaKelas;
    private String status; // 'SUDAH', 'SEDANG', 'BELUM'
    private Double nilai;
    private LocalDateTime waktuMulai;
    private LocalDateTime waktuSelesai;
}
