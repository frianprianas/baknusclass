package com.baknusbelajar.api.dto.exam;

import lombok.Data;
import java.io.Serializable;

@Data
public class SoalEssayDTO implements Serializable {
    private Long id;
    private Long ujianMapelId;
    private Long ujianId;
    private String pertanyaan;
    private String kunciJawaban;
    private Double bobotNilai;

    public Long getUjianMapelId() {
        return ujianMapelId != null ? ujianMapelId : ujianId;
    }

    public void setUjianMapelId(Long ujianMapelId) {
        this.ujianMapelId = ujianMapelId;
        if (this.ujianId == null) {
            this.ujianId = ujianMapelId;
        }
    }

    public Long getUjianId() {
        return ujianId != null ? ujianId : ujianMapelId;
    }

    public void setUjianId(Long ujianId) {
        this.ujianId = ujianId;
        if (this.ujianMapelId == null) {
            this.ujianMapelId = ujianId;
        }
    }
}
