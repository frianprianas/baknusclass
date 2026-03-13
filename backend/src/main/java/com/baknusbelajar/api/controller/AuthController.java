package com.baknusbelajar.api.controller;

import com.baknusbelajar.api.dto.auth.AuthResponse;
import com.baknusbelajar.api.dto.auth.LoginRequest;
import com.baknusbelajar.api.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            AuthResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (org.springframework.security.authentication.BadCredentialsException e) {
            return ResponseEntity.status(401)
                    .body(java.util.Map.of("message",
                            e.getMessage() != null && !e.getMessage().equals("Bad credentials") ? e.getMessage()
                                    : "Email atau Password Salah"));
        } catch (Exception e) {
            return ResponseEntity.status(400).body(java.util.Map.of("message", e.getMessage()));
        }
    }
}
