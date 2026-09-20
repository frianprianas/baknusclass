package com.baknusbelajar.api.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CekAkunRowResultDTO {
    private Integer rowNum;
    private String nisnInput;
    private String namaInput;
    private String kelasInput;

    // VALID, TIDAK_DITEMUKAN, KELAS_BERBEDA, DATA_KOSONG
    private String status;
    private String keterangan;

    // Data in DB if found
    private String dbNisn;
    private String dbNama;
    private String dbKelas;
    private String dbEmail;
    private Boolean dbActive;
}
