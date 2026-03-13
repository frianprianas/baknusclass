package com.baknusbelajar.api.controller;

import com.baknusbelajar.api.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import com.baknusbelajar.api.dto.user.UserResponseDTO;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<List<UserResponseDTO>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @PostMapping("/sync-mailcow")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> syncMailcow() {
        userService.syncAllWithMailcow();
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{id}/profile")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<Void> updateProfile(@PathVariable Long id,
            @RequestBody com.baknusbelajar.api.dto.user.UpdateProfileRequest request) {
        userService.updateProfile(id, request);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{id}/toggle-status")
    @PreAuthorize("hasAnyRole('ADMIN', 'TU')")
    public ResponseEntity<Void> toggleStatus(@PathVariable Long id) {
        userService.toggleUserStatus(id);
        return ResponseEntity.ok().build();
    }
}
