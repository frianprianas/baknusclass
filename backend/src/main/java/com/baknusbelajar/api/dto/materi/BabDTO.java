package com.baknusbelajar.api.dto.materi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BabDTO {
    private Long id;
    private String namaBab;
    private String prolog;
    private Integer urutan;
    private Long guruMapelId;
    private List<MateriDTO> materials;
}
