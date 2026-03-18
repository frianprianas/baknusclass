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
public class TugasSiswaDTO {
    private Long id;
    private String studentName;
    private String studentEmail;
    private String subjectName;
    private String fileName;
    private String driveLink;
    private LocalDateTime submittedAt;
    private Long babId;
    private String babName;
}
