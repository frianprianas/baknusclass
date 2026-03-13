package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.enrollment.GuruMapelDTO;
import com.baknusbelajar.api.entity.Guru;
import com.baknusbelajar.api.entity.GuruMapel;
import com.baknusbelajar.api.entity.Mapel;
import com.baknusbelajar.api.repository.GuruMapelRepository;
import com.baknusbelajar.api.repository.GuruRepository;
import com.baknusbelajar.api.repository.MapelRepository;
import com.baknusbelajar.api.repository.UserRepository;
import com.baknusbelajar.api.entity.Users;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GuruMapelService {

    private final GuruMapelRepository guruMapelRepository;
    private final GuruRepository guruRepository;
    private final MapelRepository mapelRepository;
    private final UserRepository userRepository;

    public List<GuruMapelDTO> getAllGuruMapel() {
        return guruMapelRepository.findAll().stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<GuruMapelDTO> getMapelByGuruId(Long guruId) {
        return guruMapelRepository.findByGuruId(guruId).stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<GuruMapelDTO> getMapelByEmail(String emailOrUsername) {
        log.info("[getMapelByEmail] Looking up: {}", emailOrUsername);
        // Try by email first, then by username (auth.getName() returns username not
        // email)
        Optional<Users> userOpt = userRepository.findByEmail(emailOrUsername);
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByUsername(emailOrUsername);
        }
        return userOpt.map(user -> {
            log.info("[getMapelByEmail] Found user id={} role={}", user.getId(), user.getRole());
            return guruRepository.findByUserId(user.getId()).map(guru -> {
                log.info("[getMapelByEmail] Found guru id={} nama={}", guru.getId(), guru.getNamaLengkap());
                List<GuruMapel> assignments = guruMapelRepository.findByGuruId(guru.getId());
                log.info("[getMapelByEmail] Found {} assignments for guruId={}", assignments.size(), guru.getId());
                return assignments.stream().map(this::mapToDTO).collect(Collectors.toList());
            }).orElseGet(() -> {
                log.warn("[getMapelByEmail] No tb_guru record found for userId={}", user.getId());
                return java.util.Collections.emptyList();
            });
        }).orElseGet(() -> {
            log.warn("[getMapelByEmail] No user found with emailOrUsername={}", emailOrUsername);
            return java.util.Collections.emptyList();
        });
    }

    public GuruMapelDTO createGuruMapel(GuruMapelDTO dto) {
        Guru guru = guruRepository.findById(dto.getGuruId())
                .orElseThrow(() -> new RuntimeException("Guru not found"));
        Mapel mapel = mapelRepository.findById(dto.getMapelId())
                .orElseThrow(() -> new RuntimeException("Mapel not found"));

        GuruMapel entity = new GuruMapel();
        entity.setGuru(guru);
        entity.setMapel(mapel);

        return mapToDTO(guruMapelRepository.save(entity));
    }

    public void deleteGuruMapel(Long id) {
        guruMapelRepository.deleteById(id);
    }

    private GuruMapelDTO mapToDTO(GuruMapel entity) {
        GuruMapelDTO dto = new GuruMapelDTO();
        dto.setId(entity.getId());
        if (entity.getGuru() != null) {
            dto.setGuruId(entity.getGuru().getId());
            dto.setNamaGuru(entity.getGuru().getNamaLengkap());
        }
        if (entity.getMapel() != null) {
            dto.setMapelId(entity.getMapel().getId());
            dto.setNamaMapel(entity.getMapel().getNamaMapel());
        }
        if (entity.getKelas() != null) {
            dto.setKelasId(entity.getKelas().getId());
            dto.setNamaKelas(entity.getKelas().getNamaKelas());
        }
        return dto;
    }
}
