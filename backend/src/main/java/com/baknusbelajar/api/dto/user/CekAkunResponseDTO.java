package com.baknusbelajar.api.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CekAkunResponseDTO {
    private Integer totalBaris;
    private Integer totalValid;
    private Integer totalTidakDitemukan;
    private Integer totalKelasBerbeda;
    private List<CekAkunRowResultDTO> results;
}
