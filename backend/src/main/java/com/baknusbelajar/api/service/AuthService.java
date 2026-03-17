package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.auth.AuthResponse;
import com.baknusbelajar.api.dto.auth.LoginRequest;
import com.baknusbelajar.api.dto.auth.MailcowUserDTO;
import com.baknusbelajar.api.entity.Guru;
import com.baknusbelajar.api.entity.Siswa;
import com.baknusbelajar.api.entity.Users;
import com.baknusbelajar.api.repository.GuruRepository;
import com.baknusbelajar.api.repository.SiswaRepository;
import com.baknusbelajar.api.repository.UserRepository;
import com.baknusbelajar.api.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final SiswaRepository siswaRepository;
    private final GuruRepository guruRepository;
    private final MailcowAuthService mailcowAuthService;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail();
        String password = request.getPassword();

        // 1. Authenticate against Mailcow first to get the latest tags/roles
        // This ensures if a user's role changes in Mailcow, it is reflected here
        MailcowUserDTO mailcowUser = mailcowAuthService.authenticateAndGetTags(email, password);

        Optional<Users> existingUser = userRepository.findByEmail(email);
        if (existingUser.isPresent() && !existingUser.get().getIsActive()) {
            throw new BadCredentialsException("Akun Anda telah dinonaktifkan oleh Admin.");
        }

        if (mailcowUser == null) {
            // If Mailcow fails, try fallback to Oracle DB only (for local accounts)
            if (existingUser.isPresent() && passwordEncoder.matches(password, existingUser.get().getPasswordHash())) {
                return generateTokensForUser(email, password, existingUser.get());
            }
            throw new BadCredentialsException("Invalid Email or Password");
        }

        if (mailcowUser.getActive() == 0) {
            throw new BadCredentialsException("User account is disabled in Mailcow");
        }

        // 2. Determine role from latest Mailcow tags
        List<String> tags = mailcowUser.getTags();
        log.info("Tags received from Mailcow for {}: {}", email, tags);
        String role = determineRoleFromTags(tags, email);
        log.info("Determined role for {}: {}", email, role);

        // 3. Provision or Update User in Oracle Database
        Optional<Users> userOpt = userRepository.findByEmail(email);
        Users user = userOpt.orElseGet(() -> {
            Users newUser = new Users();
            newUser.setEmail(email);
            newUser.setUsername(
                    mailcowUser.getUsername() != null ? mailcowUser.getUsername().split("@")[0] : email.split("@")[0]);
            return newUser;
        });

        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole(role);
        user.setIsActive(user.getId() == null ? true : user.getIsActive());
        user.setNamaLengkap(mailcowUser.getName() != null && !mailcowUser.getName().isEmpty() ? mailcowUser.getName()
                : user.getUsername());
        Users savedUser = userRepository.save(user);

        // Provision detailed profiles if they don't exist
        provisionUserProfile(savedUser, role, mailcowUser.getName(), mailcowUser.getTags());

        return generateTokensForUser(email, password, savedUser);
    }

    private String determineRoleFromTags(List<String> tags, String email) {
        // 1. Check Tags from Mailcow
        if (tags != null && !tags.isEmpty()) {
            for (String tag : tags) {
                String t = tag.toLowerCase();
                if (t.contains("admin") || t.contains("super") || t.contains("it"))
                    return "ADMIN";
                if (t.contains("guru") || t.contains("pengajar"))
                    return "GURU";
                if (t.contains("tu") || t.contains("staff") || t.contains("tatausaha"))
                    return "TU";
                if (t.contains("siswa") || t.contains("murid"))
                    return "SISWA";
            }
        }

        // 2. Fallback: Check email prefix for Admin/SuperUser (safety net)
        String prefix = email.split("@")[0].toLowerCase();
        if (prefix.equals("admin") || prefix.equals("super") || prefix.equals("superuser") ||
                prefix.equals("it.support") || prefix.contains("superadmin") || prefix.contains("administrator")) {
            return "ADMIN";
        }

        return "SISWA"; // Default role
    }

    private void provisionUserProfile(Users user, String role, String name, List<String> tags) {
        if ("SISWA".equalsIgnoreCase(role)) {
            if (siswaRepository.findByUserId(user.getId()).isEmpty()) {
                Siswa siswa = new Siswa();
                siswa.setUser(user);
                siswa.setNamaLengkap(name != null && !name.isEmpty() ? name : user.getUsername());
                siswaRepository.save(siswa);
            }
        } else if ("GURU".equalsIgnoreCase(role) || "TU".equalsIgnoreCase(role) || "ADMIN".equalsIgnoreCase(role)) {
            if (guruRepository.findByUserId(user.getId()).isEmpty()) {
                Guru guru = new Guru();
                guru.setUser(user);
                guru.setNamaLengkap(name != null && !name.isEmpty() ? name : user.getUsername());
                guruRepository.save(guru);
            }
        }
    }

    private AuthResponse generateTokensForUser(String email, String plainPassword, Users user) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, plainPassword));

        String jwt = jwtTokenProvider.generateToken(authentication);

        // Get the real name and profile ID from entity or profiles
        String name = user.getNamaLengkap() != null ? user.getNamaLengkap() : user.getUsername();
        Long profileId = null;
        Long kelasId = null;

        if ("SISWA".equalsIgnoreCase(user.getRole())) {
            var s = siswaRepository.findByUserId(user.getId());
            name = s.map(Siswa::getNamaLengkap).orElse(name);
            profileId = s.map(Siswa::getId).orElse(null);
            kelasId = s.map(siswa -> siswa.getKelas() != null ? siswa.getKelas().getId() : null).orElse(null);
        } else if ("GURU".equalsIgnoreCase(user.getRole()) || "TU".equalsIgnoreCase(user.getRole())
                || "ADMIN".equalsIgnoreCase(user.getRole())) {
            var g = guruRepository.findByUserId(user.getId());
            name = g.map(Guru::getNamaLengkap).orElse(name);
            profileId = g.map(Guru::getId).orElse(null);
        }

        return new AuthResponse(jwt, user.getRole(), user.getEmail(), name, profileId, user.getId(), kelasId);
    }
}
