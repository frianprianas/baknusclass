package com.baknusbelajar.api.dto.exam;

import lombok.Data;
import java.time.LocalDate;

@Data
public class EventUjianDTO {
    private Long id;
    private String namaEvent;
    private String semester;
    private String tahunAjaran;
    private LocalDate tanggalMulai;
    private LocalDate tanggalSelesai;
    private Boolean statusAktif;
    private java.util.List<Long> proktorIds;
}
