package com.baknusbelajar.api.dto.forum;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ForumAnalysisDTO {
    private Long topikId;
    private String ringkasan;
    private List<ActiveUserDTO> userPalingAktif;
    private List<ContributorDTO> kontributorTerbaik;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ActiveUserDTO {
        private String nama;
        private Long jumlahPesan;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ContributorDTO {
        private String nama;
        private String alasan;
    }
}
