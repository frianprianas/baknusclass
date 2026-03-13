package com.baknusbelajar.api.dto.dashboard;

import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
@Builder
public class DashboardSummaryDTO {
    private long totalSiswa;
    private long totalGuru;
    private long totalJurusan;
    private long totalMapel;
    private long totalUjianAktif;
    private long totalJawabanPerluReview;
    private List<Map<String, Object>> sebaranNilaiSiswa; // e.g. [{range: '80-100', count: 5}, ...]
    private List<Map<String, Object>> aktivitasTerakhir; // e.g. [{user: 'Iyan', action: 'Submit Ujian Matematika',
                                                         // date: '...'}]
}
