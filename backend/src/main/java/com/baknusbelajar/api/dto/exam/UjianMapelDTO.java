package com.baknusbelajar.api.dto.exam;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class UjianMapelDTO {
    private Long id;
    private Long eventId;
    private String namaEvent; // Response context
    private Long guruMapelId;
    private String namaMapel; // Response context
    private String namaGuru; // Response context
    private LocalDateTime waktuMulai;
    private LocalDateTime waktuSelesai;
    private Integer durasi;
    private String token;
    private Boolean isFinished;
    private Long sisaWaktuDetik; // Ditambahkan untuk menyimpan sisa durasi ujian dalam detik
    private Boolean tampilkanNilai; // Kontrol visibilitas raport
    private Double nilaiAkhir; // Hanya untuk SISWA jika dipublikasikan
}
