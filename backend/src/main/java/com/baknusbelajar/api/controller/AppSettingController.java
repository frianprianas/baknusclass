package com.baknusbelajar.api.controller;

import com.baknusbelajar.api.service.AppSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class AppSettingController {

    private final AppSettingService appSettingService;

    @GetMapping
    public ResponseEntity<Map<String, String>> getAllSettings() {
        return ResponseEntity.ok(appSettingService.getAllSettings());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> updateSettings(@RequestBody Map<String, String> settings) {
        appSettingService.updateSettings(settings);
        return ResponseEntity.ok().build();
    }
}
