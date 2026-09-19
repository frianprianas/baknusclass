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
import com.baknusbelajar.api.security.CustomUserDetails;
import com.baknusbelajar.api.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail();
        String password = request.getPassword();

        // 1. FAST PATH: Cek apakah user sudah terdaftar di database lokal dan password cocok dengan hash
        Optional<Users> existingUserOpt = userRepository.findByEmail(email);
        if (existingUserOpt.isPresent()) {
            Users existingUser = existingUserOpt.get();
            if (!Boolean.TRUE.equals(existingUser.getIsActive())) {
                throw new BadCredentialsException("Akun Anda telah dinonaktifkan oleh Admin.");
            }

            // Jika password cocok dengan hash lokal (instant login ~50ms tanpa tunggu handshake IMAP)
            if (existingUser.getPasswordHash() != null && passwordEncoder.matches(password, existingUser.getPasswordHash())) {
                log.info("Fast-path login successful for: {}", email);
                return generateTokensForUser(existingUser);
            }
        }

        // 2. SLOW PATH: User baru pertama kali login ATAU password baru saja diubah di Mailcow
        MailcowUserDTO mailcowUser = mailcowAuthService.authenticateAndGetTags(email, password);
        if (mailcowUser == null) {
            throw new BadCredentialsException("Invalid Email or Password");
        }

        if (mailcowUser.getActive() == 0) {
            throw new BadCredentialsException("User account is disabled in Mailcow");
        }

        // Determine role from latest Mailcow tags
        List<String> tags = mailcowUser.getTags();
        log.info("Tags received from Mailcow for {}: {}", email, tags);
        String role = determineRoleFromTags(tags, email);
        log.info("Determined role for {}: {}", email, role);

        // Provision or Update User in Database
        Users user = existingUserOpt.orElseGet(() -> {
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

        return generateTokensForUser(savedUser);
    }

    private String determineRoleFromTags(List<String> tags, String email) {
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

        String prefix = email.split("@")[0].toLowerCase();
        if (prefix.equals("admin") || prefix.equals("super") || prefix.equals("superuser") ||
                prefix.equals("it.support") || prefix.contains("superadmin") || prefix.contains("administrator")) {
            return "ADMIN";
        }

        return "SISWA";
    }

    private void provisionUserProfile(Users user, String role, String name, List<String> tags) {
        if ("SISWA".equalsIgnoreCase(role)) {
            if (siswaRepository.findByUserId(user.getId()).isEmpty()) {
                Siswa siswa = new Siswa();
                siswa.setUser(user);
                siswa.setNamaLengkap(name != null && !name.isEmpty() ? name : user.getUsername());
                siswaRepository.saveAndFlush(siswa);
            }
        } else if ("GURU".equalsIgnoreCase(role) || "TU".equalsIgnoreCase(role) || "ADMIN".equalsIgnoreCase(role)) {
            if (guruRepository.findByUserId(user.getId()).isEmpty()) {
                Guru guru = new Guru();
                guru.setUser(user);
                guru.setNamaLengkap(name != null && !name.isEmpty() ? name : user.getUsername());
                guruRepository.saveAndFlush(guru);
            }
        }
    }

    private AuthResponse generateTokensForUser(Users user) {
        String name = user.getNamaLengkap() != null ? user.getNamaLengkap() : user.getUsername();
        Long profileId = null;
        Long kelasId = null;
        String namaKelas = null;
        Boolean isCoAdmin = false;

        if ("SISWA".equalsIgnoreCase(user.getRole())) {
            var s = siswaRepository.findByUserId(user.getId());
            if (s.isEmpty()) {
                s = siswaRepository.findFirstByUserIdOrderByIdAsc(user.getId());
            }
            if (s.isPresent()) {
                var siswa = s.get();
                name = siswa.getNamaLengkap() != null ? siswa.getNamaLengkap() : name;
                profileId = siswa.getId();
                if (siswa.getKelas() != null) {
                    kelasId = siswa.getKelas().getId();
                    namaKelas = siswa.getKelas().getNamaKelas();
                }
            }
        } else {
            var g = guruRepository.findByUserId(user.getId());
            if (g.isPresent()) {
                var guru = g.get();
                name = guru.getNamaLengkap() != null ? guru.getNamaLengkap() : name;
                profileId = guru.getId();
                isCoAdmin = Boolean.TRUE.equals(guru.getIsCoAdmin());
            }
        }

        CustomUserDetails userDetails = CustomUserDetails.create(user, Boolean.TRUE.equals(isCoAdmin));
        Authentication authentication = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        String jwt = jwtTokenProvider.generateToken(authentication);

        return new AuthResponse(jwt, user.getRole(), user.getEmail(), name, profileId, user.getId(), kelasId, namaKelas, isCoAdmin);
    }
}
