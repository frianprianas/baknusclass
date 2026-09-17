package com.baknusbelajar.api.dto.exam;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
public class ExamClassSummaryDTO {
    private Long ujianId;
    private String namaMapel;
    private String namaGuru;
    private Integer totalSiswa;
    private Integer totalSelesai;
    private Integer totalBelum;
    private List<ClassSummaryItem> kelasList;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class ClassSummaryItem {
        private Long kelasId;
        private String namaKelas;
        private int jumlahSiswa;
        private int jumlahSelesai;
        private int jumlahBelum;
    }
}
