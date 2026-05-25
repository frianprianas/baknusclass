package com.baknusbelajar.api.controller;

import com.baknusbelajar.api.dto.dashboard.DashboardSummaryDTO;
import com.baknusbelajar.api.service.DashboardService;
import com.baknusbelajar.api.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('TU', 'GURU', 'ADMIN')")
    public ResponseEntity<DashboardSummaryDTO> getSummary(Authentication authentication) {
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        boolean isGuru = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_GURU"));
        
        if (isGuru) {
            return ResponseEntity.ok(dashboardService.getGuruSummaryByUserId(userDetails.getId()));
        }
        
        return ResponseEntity.ok(dashboardService.getAdminSummary());
    }
}
