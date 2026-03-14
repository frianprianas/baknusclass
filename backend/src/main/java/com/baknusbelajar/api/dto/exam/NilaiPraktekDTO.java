package com.baknusbelajar.api.dto.exam;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NilaiPraktekDTO {
    private Long id;
    private Long ujianMapelId;
    private Long siswaId;
    private String namaSiswa;
    private String nisn;
    private Integer nilai;
}
