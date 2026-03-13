package com.baknusbelajar.api.dto.auth;

import lombok.Data;
import java.util.List;

@Data
public class MailcowUserDTO {
    private String username;
    private String name;
    private List<String> tags;
    private int active;
}
