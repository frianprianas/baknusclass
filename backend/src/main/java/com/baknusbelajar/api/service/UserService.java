package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.auth.MailcowUserDTO;
import com.baknusbelajar.api.entity.*;
import com.baknusbelajar.api.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final SiswaRepository siswaRepository;
    private final GuruRepository guruRepository;
    private final KelasRepository kelasRepository;
    private final MapelRepository mapelRepository;
    private final GuruMapelRepository guruMapelRepository;
    private final MailcowAuthService mailcowAuthService;

    public List<com.baknusbelajar.api.dto.user.UserResponseDTO> getAllUsers() {
        return userRepository.findAll().stream().map(user -> {
            com.baknusbelajar.api.dto.user.UserResponseDTO dto = new com.baknusbelajar.api.dto.user.UserResponseDTO();
            dto.setId(user.getId());
            dto.setEmail(user.getEmail());
            dto.setUsername(user.getUsername());
            dto.setRole(user.getRole());
            dto.setActive(user.getIsActive());
            dto.setNamaLengkap(user.getNamaLengkap());
            dto.setPhoneNumber(user.getPhoneNumber());

            if ("SISWA".equalsIgnoreCase(user.getRole())) {
                siswaRepository.findByUserId(user.getId()).ifPresent(s -> {
                    dto.setProfileId(s.getId());
                    dto.setNisn(s.getNisn());
                    if (s.getKelas() != null) {
                        dto.setKelasId(s.getKelas().getId());
                        dto.setNamaKelas(s.getKelas().getNamaKelas());
                    }
                });
            } else if ("GURU".equalsIgnoreCase(user.getRole())) {
                guruRepository.findByUserId(user.getId()).ifPresent(g -> {
                    dto.setProfileId(g.getId());
                    dto.setNip(g.getNip());
                    List<GuruMapel> gms = guruMapelRepository.findByGuruId(g.getId());
                    dto.setMapelNames(gms.stream().map(gm -> gm.getMapel().getNamaMapel()).toList());
                    dto.setMapelIds(gms.stream().map(gm -> gm.getMapel().getId()).toList());
                    dto.setAssignments(gms.stream().map(gm -> {
                        com.baknusbelajar.api.dto.user.GuruMapelAssignment a = new com.baknusbelajar.api.dto.user.GuruMapelAssignment();
                        a.setMapelId(gm.getMapel().getId());
                        if (gm.getKelas() != null)
                            a.setKelasId(gm.getKelas().getId());
                        return a;
                    }).toList());
                });
            }
            return dto;
        }).toList();
    }

    @Transactional
    public void syncAllWithMailcow() {
        List<MailcowUserDTO> mailboxes = mailcowAuthService.getAllMailboxes();
        log.info("Starting mass sync with Mailcow, found {} mailboxes", mailboxes.size());

        for (MailcowUserDTO mb : mailboxes) {
            try {
                syncSingleUser(mb);
            } catch (Exception e) {
                log.error("Failed to sync mailbox: {}", mb.getUsername(), e);
            }
        }
    }

    private void syncSingleUser(MailcowUserDTO mb) {
        String email = mb.getUsername();
        if (email == null)
            return;

        Optional<Users> userOpt = userRepository.findByEmail(email);

        List<String> tags = mb.getTags();
        String role = determineRoleFromTags(tags, email);

        Users user = userOpt.orElseGet(() -> {
            Users newUser = new Users();
            newUser.setEmail(email);
            newUser.setUsername(email.split("@")[0]);
            return newUser;
        });

        user.setRole(role);
        user.setIsActive(mb.getActive() == 1);
        String syncName = mb.getName() != null && !mb.getName().isEmpty() ? mb.getName() : user.getUsername();
        user.setNamaLengkap(syncName);
        log.info("Syncing user {}: Role={}, Name={}", email, role, syncName);
        // We don't update password during mass sync as we don't have it

        Users savedUser = userRepository.save(user);
        provisionUserProfile(savedUser, role, mb.getName(), mb.getTags());
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
                prefix.equals("it.support") || prefix.contains("superadmin")) {
            return "ADMIN";
        }

        return "SISWA";
    }

    private void provisionUserProfile(Users user, String role, String name, List<String> tags) {
        if ("SISWA".equalsIgnoreCase(role)) {
            Siswa siswa = siswaRepository.findByUserId(user.getId()).orElseGet(() -> {
                Siswa s = new Siswa();
                s.setUser(user);
                return s;
            });
            siswa.setNamaLengkap(name != null && !name.isEmpty() ? name : user.getUsername());

            // Smart Class Assignment from Tags (e.g., tag "X RPL 1")
            if (tags != null) {
                for (String tag : tags) {
                    Optional<Kelas> kelasOpt = kelasRepository.findAll().stream()
                            .filter(k -> k.getNamaKelas().equalsIgnoreCase(tag))
                            .findFirst();
                    if (kelasOpt.isPresent()) {
                        siswa.setKelas(kelasOpt.get());
                        log.info("Auto-assigned student {} to class {}", user.getEmail(), tag);
                        break;
                    }
                }
            }
            siswaRepository.save(siswa);

        } else if ("GURU".equalsIgnoreCase(role) || "TU".equalsIgnoreCase(role) || "ADMIN".equalsIgnoreCase(role)) {
            Guru guru = guruRepository.findByUserId(user.getId()).orElseGet(() -> {
                Guru g = new Guru();
                g.setUser(user);
                return g;
            });
            guru.setNamaLengkap(name != null && !name.isEmpty() ? name : user.getUsername());
            Guru savedGuru = guruRepository.save(guru);

            // Smart Subject Assignment from Tags (e.g., tag "Matematika")
            if ("GURU".equalsIgnoreCase(role) && tags != null) {
                for (String tag : tags) {
                    Optional<Mapel> mapelOpt = mapelRepository.findAll().stream()
                            .filter(m -> m.getNamaMapel().equalsIgnoreCase(tag)
                                    || m.getKodeMapel().equalsIgnoreCase(tag))
                            .findFirst();

                    if (mapelOpt.isPresent()) {
                        Mapel m = mapelOpt.get();
                        if (guruMapelRepository.findAll().stream()
                                .noneMatch(gm -> gm.getGuru().getId().equals(savedGuru.getId())
                                        && gm.getMapel().getId().equals(m.getId()))) {
                            GuruMapel gm = new GuruMapel();
                            gm.setGuru(savedGuru);
                            gm.setMapel(m);
                            guruMapelRepository.save(gm);
                            log.info("Auto-assigned teacher {} to subject {}", user.getEmail(), m.getNamaMapel());
                        }
                    }
                }
            }
        }
    }

    @Transactional
    public void updateProfile(Long userId, com.baknusbelajar.api.dto.user.UpdateProfileRequest request) {
        Users user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (request.getNamaLengkap() != null) {
            user.setNamaLengkap(request.getNamaLengkap());
        }
        if (request.getPhoneNumber() != null) {
            user.setPhoneNumber(request.getPhoneNumber());
        }
        if (request.getRole() != null) {
            user.setRole(request.getRole());
        }
        userRepository.save(user);

        String role = user.getRole();
        if ("SISWA".equalsIgnoreCase(role)) {
            Siswa siswa = siswaRepository.findByUserId(userId).orElseGet(() -> {
                Siswa s = new Siswa();
                s.setUser(user);
                return s;
            });
            if (request.getNamaLengkap() != null)
                siswa.setNamaLengkap(request.getNamaLengkap());
            if (request.getNisn() != null)
                siswa.setNisn(request.getNisn());
            if (request.getKelasId() != null) {
                siswa.setKelas(kelasRepository.findById(request.getKelasId()).orElse(null));
            }
            siswaRepository.save(siswa);
        } else if ("GURU".equalsIgnoreCase(role) || "TU".equalsIgnoreCase(role) || "ADMIN".equalsIgnoreCase(role)) {
            Guru guru = guruRepository.findByUserId(userId).orElseGet(() -> {
                Guru g = new Guru();
                g.setUser(user);
                return g;
            });
            if (request.getNamaLengkap() != null)
                guru.setNamaLengkap(request.getNamaLengkap());
            if (request.getNip() != null)
                guru.setNip(request.getNip());
            Guru savedGuru = guruRepository.save(guru);

            if ("GURU".equalsIgnoreCase(role)) {
                if (request.getAssignments() != null) {
                    List<GuruMapel> existingAssignments = guruMapelRepository.findByGuruId(savedGuru.getId());
                    
                    for (com.baknusbelajar.api.dto.user.GuruMapelAssignment assign : request.getAssignments()) {
                        boolean exists = false;
                        for (int i = 0; i < existingAssignments.size(); i++) {
                            GuruMapel gm = existingAssignments.get(i);
                            Long exMapelId = gm.getMapel() != null ? gm.getMapel().getId() : null;
                            Long exKelasId = gm.getKelas() != null ? gm.getKelas().getId() : null;
                            
                            if (java.util.Objects.equals(exMapelId, assign.getMapelId()) &&
                                java.util.Objects.equals(exKelasId, assign.getKelasId())) {
                                exists = true;
                                existingAssignments.remove(i);
                                break;
                            }
                        }
                        
                        if (!exists) {
                            mapelRepository.findById(assign.getMapelId()).ifPresent(m -> {
                                GuruMapel newGm = new GuruMapel();
                                newGm.setGuru(savedGuru);
                                newGm.setMapel(m);
                                if (assign.getKelasId() != null) {
                                    kelasRepository.findById(assign.getKelasId()).ifPresent(newGm::setKelas);
                                }
                                guruMapelRepository.save(newGm);
                            });
                        }
                    }
                    
                    for (GuruMapel toDelete : existingAssignments) {
                        try {
                            if (guruMapelRepository.isSafeToDelete(toDelete.getId())) {
                                guruMapelRepository.delete(toDelete);
                            } else {
                                log.warn("Cannot delete GuruMapel {} because it is referenced by Ujian, Materi, etc. Keeping it.", toDelete.getId());
                            }
                        } catch (Exception e) {
                            log.error("Failed to delete obsolete GuruMapel {}", toDelete.getId(), e);
                        }
                    }
                } else if (request.getMapelIds() != null) {
                    // Fallback for simple mapel selection
                    List<GuruMapel> existingAssignments = guruMapelRepository.findByGuruId(savedGuru.getId());
                    
                    for (Long mapelId : request.getMapelIds()) {
                        boolean exists = false;
                        for (int i = 0; i < existingAssignments.size(); i++) {
                            GuruMapel gm = existingAssignments.get(i);
                            Long exMapelId = gm.getMapel() != null ? gm.getMapel().getId() : null;
                            if (java.util.Objects.equals(exMapelId, mapelId)) {
                                exists = true;
                                existingAssignments.remove(i);
                                break;
                            }
                        }
                        if (!exists) {
                            mapelRepository.findById(mapelId).ifPresent(m -> {
                                GuruMapel gm = new GuruMapel();
                                gm.setGuru(savedGuru);
                                gm.setMapel(m);
                                guruMapelRepository.save(gm);
                            });
                        }
                    }
                    
                    for (GuruMapel toDelete : existingAssignments) {
                        try {
                            if (guruMapelRepository.isSafeToDelete(toDelete.getId())) {
                                guruMapelRepository.delete(toDelete);
                            } else {
                                log.warn("Cannot delete GuruMapel {} because it is referenced. Keeping it.", toDelete.getId());
                            }
                        } catch (Exception e) {
                            log.error("Failed to delete obsolete GuruMapel {}", toDelete.getId(), e);
                        }
                    }
                }
            }
        }
    }

    @Transactional
    public void toggleUserStatus(Long userId) {
        Users user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setIsActive(!user.getIsActive());
        userRepository.save(user);
    }
}
