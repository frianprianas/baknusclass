package com.baknusbelajar.api.dto.forum;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ForumWSMessage {
    private String type; // "COMMENT", "TYPING"
    private Long topikId;
    private Long userId;
    private String namaUser;
    private Object data; // The actual comment DTO or boolean for typing
}
