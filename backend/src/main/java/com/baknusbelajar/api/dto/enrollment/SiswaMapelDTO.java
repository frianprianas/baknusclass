package com.baknusbelajar.api.dto.enrollment;

import lombok.Data;

@Data
public class SiswaMapelDTO {
    private Long id;
    private Long siswaId;
    private String namaSiswa;
    private String nisn;
    private Long kelasId;
    private String namaKelas;
    private Long mapelId;
    private String namaMapel;
}
