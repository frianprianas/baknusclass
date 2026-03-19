package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.exam.UjianMapelDTO;
import com.baknusbelajar.api.entity.EventUjian;
import com.baknusbelajar.api.entity.GuruMapel;
import com.baknusbelajar.api.entity.UjianMapel;
import com.baknusbelajar.api.repository.EventUjianRepository;
import com.baknusbelajar.api.repository.GuruMapelRepository;
import com.baknusbelajar.api.repository.SiswaRepository;
import com.baknusbelajar.api.repository.UjianMapelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UjianMapelService {

    private final UjianMapelRepository ujianMapelRepository;
    private final EventUjianRepository eventUjianRepository;
    private final GuruMapelRepository guruMapelRepository;
    private final SiswaRepository siswaRepository;
    private final com.baknusbelajar.api.repository.SiswaUjianStatusRepository siswaUjianStatusRepository;
    private final BaknusDriveService baknusDriveService;
    private final JawabanSiswaService jawabanSiswaService;

    public List<com.baknusbelajar.api.dto.exam.ExamMonitoringDTO> getExamMonitoring(Long ujianId,
            java.util.Set<String> onlineStudents) {
        UjianMapel ujian = ujianMapelRepository.findById(ujianId)
                .orElseThrow(() -> new RuntimeException("Ujian not found"));

        if (ujian.getGuruMapel() == null || ujian.getGuruMapel().getKelas() == null) {
            return java.util.Collections.emptyList();
        }

        Long kelasId = ujian.getGuruMapel().getKelas().getId();
        List<com.baknusbelajar.api.entity.Siswa> siswaList = siswaRepository.findByKelasId(kelasId);

        return siswaList.stream().map(siswa -> {
            com.baknusbelajar.api.dto.exam.ExamMonitoringDTO dto = new com.baknusbelajar.api.dto.exam.ExamMonitoringDTO();
            dto.setSiswaId(siswa.getId());
            dto.setNisn(siswa.getNisn());
            dto.setNamaSiswa(siswa.getNamaLengkap());

            // Periksa online status
            boolean isOnline = onlineStudents.stream().anyMatch(os -> os.startsWith(siswa.getNisn() + ":"));
            dto.setIsOnline(isOnline);

            // Periksa finished status
            boolean isFinished = siswaUjianStatusRepository.findBySiswaIdAndUjianMapelId(siswa.getId(), ujianId)
                    .map(status -> status.getStatusSelesai())
                    .orElse(false);
            dto.setIsFinished(isFinished);

            return dto;
        }).collect(Collectors.toList());
    }

    public List<UjianMapelDTO> getUjianByEvent(Long eventId) {
        return ujianMapelRepository.findByEventUjianId(eventId).stream()
                .map(e -> mapToDTO(e, true))
                .collect(Collectors.toList());
    }

    public List<UjianMapelDTO> getUjianForStudent(Long eventId, Long userId) {
        var siswa = siswaRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Siswa record not found"));

        return ujianMapelRepository.findByEventUjianIdAndGuruMapelKelasId(eventId, siswa.getKelas().getId())
                .stream()
                .map(e -> {
                    UjianMapelDTO dto = mapToDTO(e, false);
                    boolean isFinished = siswaUjianStatusRepository
                            .findBySiswaIdAndUjianMapelId(siswa.getId(), e.getId())
                            .map(status -> status.getStatusSelesai())
                            .orElse(false);
                    dto.setIsFinished(isFinished);

                    siswaUjianStatusRepository.findBySiswaIdAndUjianMapelId(siswa.getId(), e.getId())
                            .ifPresent(status -> {
                                if (status.getWaktuMulaiSiswa() != null && !isFinished) {
                                    long secondsElapsed = java.time.Duration
                                            .between(status.getWaktuMulaiSiswa(), java.time.LocalDateTime.now())
                                            .getSeconds();
                                    long remainingDetik = (e.getDurasi() * 60) - secondsElapsed;
                                    if (remainingDetik < 0)
                                        remainingDetik = 0;
                                    dto.setSisaWaktuDetik(remainingDetik);
                                }
                            });

                    return dto;
                })
                .collect(Collectors.toList());
    }

    public void markUjianAsFinished(Long ujianId, Long userId) {
        var siswa = siswaRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Siswa record not found"));

        com.baknusbelajar.api.entity.UjianMapel ujian = ujianMapelRepository.findById(ujianId)
                .orElseThrow(() -> new RuntimeException("UjianMapel not found"));

        com.baknusbelajar.api.entity.SiswaUjianStatus status = siswaUjianStatusRepository
                .findBySiswaIdAndUjianMapelId(siswa.getId(), ujianId)
                .orElseGet(() -> {
                    com.baknusbelajar.api.entity.SiswaUjianStatus newStatus = new com.baknusbelajar.api.entity.SiswaUjianStatus();
                    newStatus.setSiswa(siswa);
                    newStatus.setUjianMapel(ujian);
                    return newStatus;
                });

        status.setStatusSelesai(true);
        status.setWaktuSelesai(java.time.LocalDateTime.now());
        siswaUjianStatusRepository.save(status);

        // Trigger automatic AI scoring if enabled
        jawabanSiswaService.processAiScoringForUjianAndSiswa(ujianId, siswa.getId());
    }

    public List<UjianMapelDTO> getUjianByGuruMapel(Long guruMapelId) {
        return ujianMapelRepository.findByGuruMapelId(guruMapelId).stream()
                .map(e -> mapToDTO(e, true))
                .collect(Collectors.toList());
    }

    public UjianMapelDTO createUjianMapel(UjianMapelDTO dto) {
        EventUjian event = eventUjianRepository.findById(dto.getEventId())
                .orElseThrow(() -> new RuntimeException("Event Ujian not found"));
        GuruMapel gm = guruMapelRepository.findById(dto.getGuruMapelId())
                .orElseThrow(() -> new RuntimeException("GuruMapel assignment not found"));

        UjianMapel entity = new UjianMapel();
        entity.setEventUjian(event);
        entity.setGuruMapel(gm);
        entity.setWaktuMulai(dto.getWaktuMulai());
        entity.setWaktuSelesai(dto.getWaktuSelesai());
        entity.setDurasi(dto.getDurasi());
        entity.setToken(generateRandomToken());

        UjianMapel saved = ujianMapelRepository.save(entity);

        // Notify BaknusDrive to create subject folder
        try {
            if (event.getNamaEvent() != null && gm.getMapel() != null) {
                baknusDriveService.createSubjectFolder(event.getNamaEvent(), gm.getMapel().getNamaMapel());
            }
        } catch (Exception e) {
            log.error("Failed to trigger subject folder creation in BaknusDrive: {}", e.getMessage());
        }

        return mapToDTO(saved, true);
    }

    private String generateRandomToken() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder sb = new StringBuilder();
        Random random = new Random();
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    public boolean validateToken(Long ujianId, String token, Long userId) {
        UjianMapel entity = ujianMapelRepository.findById(ujianId)
                .orElseThrow(() -> new RuntimeException("Ujian not found"));

        boolean isValid = entity.getToken() != null && entity.getToken().equalsIgnoreCase(token);

        if (isValid && userId != null) {
            var siswa = siswaRepository.findByUserId(userId)
                    .orElseThrow(() -> new RuntimeException("Siswa record not found"));

            com.baknusbelajar.api.entity.SiswaUjianStatus status = siswaUjianStatusRepository
                    .findBySiswaIdAndUjianMapelId(siswa.getId(), ujianId)
                    .orElseGet(() -> {
                        com.baknusbelajar.api.entity.SiswaUjianStatus newStatus = new com.baknusbelajar.api.entity.SiswaUjianStatus();
                        newStatus.setSiswa(siswa);
                        newStatus.setUjianMapel(entity);
                        newStatus.setWaktuMulaiSiswa(java.time.LocalDateTime.now());
                        return newStatus;
                    });

            // If already started before, do NOT overwrite waktuMulaiSiswa.
            if (status.getWaktuMulaiSiswa() == null) {
                status.setWaktuMulaiSiswa(java.time.LocalDateTime.now());
            }

            siswaUjianStatusRepository.save(status);
        }

        return isValid;
    }

    public UjianMapelDTO refreshToken(Long id) {
        UjianMapel entity = ujianMapelRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ujian not found"));
        entity.setToken(generateRandomToken());
        return mapToDTO(ujianMapelRepository.save(entity), true);
    }

    public UjianMapelDTO updateUjianMapel(Long id, UjianMapelDTO dto) {
        UjianMapel entity = ujianMapelRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("UjianMapel not found"));

        entity.setWaktuMulai(dto.getWaktuMulai());
        entity.setWaktuSelesai(dto.getWaktuSelesai());
        entity.setDurasi(dto.getDurasi());

        return mapToDTO(ujianMapelRepository.save(entity), true);
    }

    public void deleteUjian(Long id) {
        ujianMapelRepository.deleteById(id);
    }

    private UjianMapelDTO mapToDTO(UjianMapel entity, boolean includeToken) {
        UjianMapelDTO dto = new UjianMapelDTO();
        dto.setId(entity.getId());
        dto.setWaktuMulai(entity.getWaktuMulai());
        dto.setWaktuSelesai(entity.getWaktuSelesai());
        dto.setDurasi(entity.getDurasi());
        if (includeToken) {
            dto.setToken(entity.getToken());
        }

        if (entity.getEventUjian() != null) {
            dto.setEventId(entity.getEventUjian().getId());
            dto.setNamaEvent(entity.getEventUjian().getNamaEvent());
        }

        if (entity.getGuruMapel() != null) {
            dto.setGuruMapelId(entity.getGuruMapel().getId());
            if (entity.getGuruMapel().getMapel() != null) {
                dto.setNamaMapel(entity.getGuruMapel().getMapel().getNamaMapel());
            }
            if (entity.getGuruMapel().getGuru() != null) {
                dto.setNamaGuru(entity.getGuruMapel().getGuru().getNamaLengkap());
            }
        }
        return dto;
    }
}
