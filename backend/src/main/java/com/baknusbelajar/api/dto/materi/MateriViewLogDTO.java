package com.baknusbelajar.api.dto.materi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MateriViewLogDTO {
    private String materiName;
    private String siswaName;
    private LocalDateTime viewedAt;
}
