package com.baknusbelajar.api.dto.exam;

import lombok.Data;

import java.io.Serializable;

@Data
public class SoalEssayDTO implements Serializable {
    private Long id;
    private Long ujianMapelId;
    private String pertanyaan;
    private String kunciJawaban; // Optional, might be hidden in some endpoint responses
    private Double bobotNilai;
}
