package com.baknusbelajar.api.dto.user;

import lombok.Data;
import java.util.List;

@Data
public class UserResponseDTO {
    private Long id;
    private String email;
    private String username;
    private String role;
    private boolean isActive;
    private String namaLengkap;
    private Long profileId; // guruId or siswaId

    // Additional info for Siswa
    private String nisn;
    private Long kelasId;
    private String namaKelas;

    // Additional info for Guru
    private String nip;
    private List<String> mapelNames;
    private List<Long> mapelIds;
    private List<GuruMapelAssignment> assignments;
}
