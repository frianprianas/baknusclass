package com.baknusbelajar.api.dto.exam;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuestionTemplateRequestDTO {
    private Integer pgBiasaCount;
    private Integer pgKompleksCount;
    private Integer benarSalahCount;
    private Integer bsMajemukCount;
    private Integer essayCount;

    private Double defaultBobotPG;
    private Double defaultBobotEssay;
    private String namaMapel;
}

