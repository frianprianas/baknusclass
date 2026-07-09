package com.baknusbelajar.api.dto;

import lombok.Data;

@Data
public class GradeTugasRequest {
    private Long tugasSiswaId;
    private Integer nilai;
    private String catatanGuru;
}
