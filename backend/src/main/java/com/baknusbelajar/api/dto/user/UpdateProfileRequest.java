package com.baknusbelajar.api.dto.user;

import lombok.Data;
import java.util.List;

@Data
public class UpdateProfileRequest {
    private String namaLengkap;
    private Long kelasId;
    private List<Long> mapelIds; // For Teachers
    private String nisn;
    private String nip;
    private List<GuruMapelAssignment> assignments; // For mapping Mapel + Kelas for Teachers
    private String phoneNumber;
}
