package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.exam.ExamPesertaDTO;

import com.baknusbelajar.api.dto.exam.UjianMapelDTO;
import com.baknusbelajar.api.entity.EventUjian;
import com.baknusbelajar.api.entity.Guru;
import com.baknusbelajar.api.entity.GuruMapel;
import com.baknusbelajar.api.entity.UjianMapel;
import com.baknusbelajar.api.repository.EventUjianRepository;
import com.baknusbelajar.api.repository.GuruMapelRepository;
import com.baknusbelajar.api.repository.SiswaRepository;
import com.baknusbelajar.api.repository.UjianMapelRepository;
import com.baknusbelajar.api.repository.MapelRepository;
import com.baknusbelajar.api.repository.GuruRepository;
import com.baknusbelajar.api.repository.SiswaMapelRepository;
import com.baknusbelajar.api.repository.KelasRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.util.WorkbookUtil;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.GrantedAuthority;

@Slf4j
@Service
@RequiredArgsConstructor
public class UjianMapelService {

    private final UjianMapelRepository ujianMapelRepository;
    private final EventUjianRepository eventUjianRepository;
    private final GuruMapelRepository guruMapelRepository;
    private final SiswaRepository siswaRepository;
    private final com.baknusbelajar.api.repository.SiswaUjianStatusRepository siswaUjianStatusRepository;
    private final MapelRepository mapelRepository;
    private final GuruRepository guruRepository;
    private final SiswaMapelRepository siswaMapelRepository;
    private final KelasRepository kelasRepository;
    private final BaknusDriveService baknusDriveService;
    private final JawabanSiswaService jawabanSiswaService;
    private final com.baknusbelajar.api.repository.SoalEssayRepository soalEssayRepository;
    private final com.baknusbelajar.api.repository.JawabanSiswaRepository jawabanSiswaRepository;
    private final JawabanPGService jawabanPGService;
    private final com.baknusbelajar.api.repository.SoalPGRepository soalPGRepository;
    private final com.baknusbelajar.api.repository.JawabanPGRepository jawabanPGRepository;
    private final ExamStatusService examStatusService;
    private final com.baknusbelajar.api.repository.UserRepository userRepository;

    public List<com.baknusbelajar.api.dto.exam.ExamMonitoringDTO> getExamMonitoring(Long ujianId,
            java.util.Set<String> onlineStudents) {
        UjianMapel ujian = ujianMapelRepository.findById(ujianId)
                .orElseThrow(() -> new RuntimeException("Ujian not found"));

        if (ujian.getMapel() == null) {
            return java.util.Collections.emptyList();
        }

        List<com.baknusbelajar.api.entity.Siswa> siswaList = new java.util.ArrayList<>();
        if (ujian.getKelasList() != null && !ujian.getKelasList().isEmpty()) {
            for (com.baknusbelajar.api.entity.Kelas k : ujian.getKelasList()) {
                siswaList.addAll(siswaRepository.findByKelasId(k.getId()));
            }
        } else if (ujian.getGuru() != null) {
            List<com.baknusbelajar.api.entity.GuruMapel> guruMapels = guruMapelRepository.findByGuruId(ujian.getGuru().getId())
                    .stream()
                    .filter(gm -> gm.getMapel().getId().equals(ujian.getMapel().getId()))
                    .collect(Collectors.toList());

            for (com.baknusbelajar.api.entity.GuruMapel gm : guruMapels) {
                siswaList.addAll(siswaRepository.findByKelasId(gm.getKelas().getId()));
            }
        }

        Map<Long, com.baknusbelajar.api.entity.Siswa> uniqueSiswa = siswaList.stream()
                .collect(Collectors.toMap(com.baknusbelajar.api.entity.Siswa::getId, s -> s, (s1, s2) -> s1));

        return uniqueSiswa.values().stream().map(siswa -> {
            com.baknusbelajar.api.dto.exam.ExamMonitoringDTO dto = new com.baknusbelajar.api.dto.exam.ExamMonitoringDTO();
            dto.setSiswaId(siswa.getId());
            dto.setNisn(siswa.getNisn());
            dto.setNamaSiswa(siswa.getNamaLengkap());
            dto.setUjianId(ujianId);
            dto.setNamaMapel(ujian.getMapel().getNamaMapel());
            if (siswa.getKelas() != null) {
                dto.setKelasId(siswa.getKelas().getId());
                dto.setNamaKelas(siswa.getKelas().getNamaKelas());
            } else {
                dto.setNamaKelas("Tanpa Kelas");
            }

            // Periksa online status
            boolean isOnline = onlineStudents != null && onlineStudents.stream().anyMatch(os -> os.startsWith(siswa.getNisn() + ":"));
            dto.setIsOnline(isOnline);

            // Periksa status pengerjaan & waktu
            var statusOpt = siswaUjianStatusRepository.findBySiswaIdAndUjianMapelId(siswa.getId(), ujianId);
            boolean isFinished = statusOpt.map(status -> Boolean.TRUE.equals(status.getStatusSelesai())).orElse(false);
            dto.setIsFinished(isFinished);

            if (statusOpt.isPresent()) {
                var status = statusOpt.get();
                dto.setWaktuMulai(status.getWaktuMulaiSiswa());
                dto.setWaktuSelesai(status.getWaktuSelesai());
                if (status.getWaktuMulaiSiswa() != null && !isFinished && ujian.getDurasi() != null) {
                    long elapsed = java.time.Duration.between(status.getWaktuMulaiSiswa(), java.time.LocalDateTime.now()).getSeconds();
                    long remaining = (ujian.getDurasi() * 60) - elapsed;
                    dto.setSisaWaktuDetik(Math.max(0, remaining));
                }
            }

            if (isFinished) {
                dto.setStatusText("SELESAI");
            } else if (dto.getWaktuMulai() != null || isOnline) {
                dto.setStatusText("SEDANG_MENGERJAKAN");
            } else {
                dto.setStatusText("BELUM_MULAI");
            }

            return dto;
        }).sorted(java.util.Comparator.comparing(com.baknusbelajar.api.dto.exam.ExamMonitoringDTO::getNamaSiswa))
          .collect(Collectors.toList());
    }
    public List<UjianMapelDTO> getUjianByEvent(Long eventId) {
        return ujianMapelRepository.findByEventUjianId(eventId).stream()
                .map(e -> mapToDTO(e, true))
                .collect(Collectors.toList());
    }

    public com.baknusbelajar.api.entity.Siswa getOrCreateSiswaForUser(Long userId) {
        return siswaRepository.findByUserId(userId).orElseGet(() -> {
            var user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found with id: " + userId));
            com.baknusbelajar.api.entity.Siswa newSiswa = new com.baknusbelajar.api.entity.Siswa();
            newSiswa.setUser(user);
            newSiswa.setNisn("ADMIN-" + user.getId());
            String name = user.getNamaLengkap() != null && !user.getNamaLengkap().trim().isEmpty()
                    ? user.getNamaLengkap().trim()
                    : user.getUsername();
            if (!name.toLowerCase().contains("admin")) {
                name += " (Admin)";
            }
            newSiswa.setNamaLengkap(name);
            return siswaRepository.save(newSiswa);
        });
    }

    public List<UjianMapelDTO> getUjianForStudent(Long eventId, Long userId) {
        var user = userRepository.findById(userId).orElse(null);
        boolean isAdminOrStaff = user != null && user.getRole() != null &&
                (user.getRole().equalsIgnoreCase("ADMIN") || user.getRole().equalsIgnoreCase("TU") || user.getRole().equalsIgnoreCase("GURU"));

        var siswa = getOrCreateSiswaForUser(userId);

        List<com.baknusbelajar.api.entity.UjianMapel> rawExams = isAdminOrStaff
                ? ujianMapelRepository.findByEventUjianId(eventId)
                : ujianMapelRepository.findByEventAndStudent(eventId, siswa.getId());

        java.util.Map<String, com.baknusbelajar.api.entity.UjianMapel> distinctMap = new java.util.LinkedHashMap<>();
        java.util.Set<Long> seenIds = new java.util.HashSet<>();
        for (com.baknusbelajar.api.entity.UjianMapel e : rawExams) {
            if (e == null || e.getId() == null || seenIds.contains(e.getId())) continue;
            if (Boolean.FALSE.equals(e.getStatusAktif()) && !isAdminOrStaff) continue;
            String sig = (e.getMapel() != null ? e.getMapel().getId() : "m") + "_" +
                         (e.getGuru() != null ? e.getGuru().getId() : "g") + "_" +
                         (e.getWaktuMulai() != null ? e.getWaktuMulai().toString() : e.getId().toString());
            if (!distinctMap.containsKey(sig)) {
                seenIds.add(e.getId());
                distinctMap.put(sig, e);
            }
        }

        return distinctMap.values().stream()
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
                                    if (e.getWaktuMulai() != null && status.getWaktuMulaiSiswa().isBefore(e.getWaktuMulai())) {
                                        dto.setSisaWaktuDetik((long) (e.getDurasi() * 60));
                                    } else {
                                        long secondsElapsed = java.time.Duration
                                                .between(status.getWaktuMulaiSiswa(), java.time.LocalDateTime.now())
                                                .getSeconds();
                                        long remainingDetik = (e.getDurasi() * 60) - secondsElapsed;
                                        if (remainingDetik < 0)
                                            remainingDetik = 0;
                                        dto.setSisaWaktuDetik(remainingDetik);
                                    }
                                }
                            });

                    if (isFinished && dto.getTampilkanNilai()) {
                        try {
                            var questions = soalEssayRepository.findByUjianMapelId(e.getId());
                            var userAnswers = jawabanSiswaRepository
                                    .findBySiswaIdAndSoalEssay_UjianMapel_Id(siswa.getId(), e.getId());

                            if (!questions.isEmpty()) {
                                double totalSkor = userAnswers.stream()
                                        .mapToDouble(a -> a.getSkorFinalGuru() != null ? a.getSkorFinalGuru() : 0.0)
                                        .sum();
                                dto.setNilaiAkhir(Math.round((totalSkor / questions.size()) * 10.0) / 10.0);
                            }
                        } catch (Exception ex) {
                            log.error("Error calculating nilaiAkhir for student: {}", ex.getMessage());
                        }
                    }

                    return dto;
                })
                .collect(Collectors.toList());
    }

    public void markUjianAsFinished(Long ujianId, Long userId) {
        var siswa = getOrCreateSiswaForUser(userId);

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

        // Auto-scoring PG:
        try {
            jawabanPGService.evaluateAndEnsureScoresForUjianAndSiswa(ujianId, siswa.getId());
        } catch (Exception ex) {
            log.error("Error auto-scoring PG for ujian: {}, siswa: {}", ujianId, siswa.getId(), ex);
        }

        // Trigger automatic AI scoring if enabled
        jawabanSiswaService.processAiScoringForUjianAndSiswa(ujianId, siswa.getId());
    }

    public List<UjianMapelDTO> getUjianByGuruId(Long guruId) {
        return ujianMapelRepository.findByGuruId(guruId).stream()
                .map(e -> mapToDTO(e, true))
                .collect(Collectors.toList());
    }

    public UjianMapelDTO createUjianMapel(UjianMapelDTO dto) {
        EventUjian event = null;
        if (dto.getEventId() != null) {
            event = eventUjianRepository.findById(dto.getEventId())
                    .orElseThrow(() -> new RuntimeException("Event Ujian not found"));
        }

        com.baknusbelajar.api.entity.Mapel mapel = mapelRepository.findById(dto.getMapelId())
                .orElseThrow(() -> new RuntimeException("Mapel not found"));
        com.baknusbelajar.api.entity.Guru guru = guruRepository.findById(dto.getGuruId())
                .orElseThrow(() -> new RuntimeException("Guru not found"));

        UjianMapel entity = new UjianMapel();
        entity.setKelasList(new java.util.HashSet<>());
        entity.setEventUjian(event);
        
        if (dto.getJenisUjian() != null) {
            try {
                entity.setJenisUjian(com.baknusbelajar.api.entity.JenisUjian.valueOf(dto.getJenisUjian()));
            } catch (Exception e) {
                entity.setJenisUjian(com.baknusbelajar.api.entity.JenisUjian.UJIAN_UTAMA);
            }
        }
        
        if (dto.getPembuatGuruId() != null) {
            com.baknusbelajar.api.entity.Guru pembuat = guruRepository.findById(dto.getPembuatGuruId()).orElse(null);
            entity.setPembuatGuru(pembuat);
        }

        entity.setMapel(mapel);
        entity.setGuru(guru);
        entity.setWaktuMulai(dto.getWaktuMulai());
        entity.setWaktuSelesai(dto.getWaktuSelesai());
        entity.setDurasi(dto.getDurasi());
        if (dto.getToken() != null && !dto.getToken().isEmpty()) {
            entity.setToken(dto.getToken());
        } else {
            entity.setToken(generateRandomToken());
        }
        if (dto.getTampilkanNilai() != null)
            entity.setTampilkanNilai(dto.getTampilkanNilai());
        entity.setStatusAktif(dto.getStatusAktif() != null ? dto.getStatusAktif() : true);

        if (dto.getKelasIds() != null && !dto.getKelasIds().isEmpty()) {
            java.util.List<com.baknusbelajar.api.entity.Kelas> kelasList = kelasRepository.findAllById(dto.getKelasIds());
            entity.getKelasList().addAll(kelasList);
        }

        UjianMapel saved = ujianMapelRepository.save(entity);

        // Notify BaknusDrive to create subject folder
        try {
            if (event != null && event.getNamaEvent() != null && mapel != null) {
                baknusDriveService.createSubjectFolder(event.getNamaEvent(), mapel.getNamaMapel());
            } else if (mapel != null && entity.getJenisUjian() == com.baknusbelajar.api.entity.JenisUjian.ULANGAN_HARIAN) {
                baknusDriveService.createSubjectFolder("Ulangan Harian", mapel.getNamaMapel());
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

        if (Boolean.FALSE.equals(entity.getStatusAktif())) {
            throw new RuntimeException("Ujian ini sedang ditutup oleh guru/admin.");
        }
        String actualToken = entity.getToken() != null ? entity.getToken().trim() : "";
        if (actualToken.isEmpty()) {
            actualToken = generateRandomToken();
            entity.setToken(actualToken);
            ujianMapelRepository.save(entity);
        }

        var user = userRepository.findById(userId).orElse(null);
        boolean isAdminOrStaff = user != null && user.getRole() != null &&
                (user.getRole().equalsIgnoreCase("ADMIN") || user.getRole().equalsIgnoreCase("TU") || user.getRole().equalsIgnoreCase("GURU"));

        String submittedToken = token != null ? token.trim() : "";
        boolean isValid = isAdminOrStaff || (!submittedToken.isEmpty() && actualToken.equalsIgnoreCase(submittedToken));

        // Time window & 30-minute late tolerance check for students
        if (!isAdminOrStaff) {
            boolean isPractice = (entity.getDurasi() != null && entity.getDurasi() == 0) ||
                    (entity.getEventUjian() != null && entity.getEventUjian().getNamaEvent() != null &&
                     (entity.getEventUjian().getNamaEvent().toLowerCase().contains("latihan") ||
                      entity.getEventUjian().getNamaEvent().toLowerCase().contains("simulasi")));

            if (!isPractice && entity.getWaktuMulai() != null) {
                java.time.LocalDateTime now = java.time.LocalDateTime.now();
                DateTimeFormatter dtf = DateTimeFormatter.ofPattern("HH:mm");

                // 1. Sebelum waktu mulai
                if (now.isBefore(entity.getWaktuMulai())) {
                    throw new RuntimeException("Ujian belum dimulai. Ujian baru dapat diakses pada jam " +
                            entity.getWaktuMulai().format(dtf) + " WIB.");
                }

                // Cek apakah siswa sudah pernah mulai pengerjaan sebelumnya
                var siswa = getOrCreateSiswaForUser(userId);
                var existingStatus = siswaUjianStatusRepository
                        .findBySiswaIdAndUjianMapelId(siswa.getId(), ujianId)
                        .orElse(null);
                boolean hasStarted = existingStatus != null && existingStatus.getWaktuMulaiSiswa() != null;

                // 2. Jika belum pernah mulai, periksa toleransi 30 menit dari waktuMulai
                if (!hasStarted) {
                    java.time.LocalDateTime batasToleransi = entity.getWaktuMulai().plusMinutes(30);
                    if (now.isAfter(batasToleransi)) {
                        throw new RuntimeException("Batas toleransi masuk ujian telah berakhir (Maksimal 30 menit setelah ujian dimulai pukul " +
                                entity.getWaktuMulai().format(dtf) + " WIB). Silakan hubungi proktor/pengawas.");
                    }
                }

                // 3. Periksa apakah waktu selesai ujian telah terlewati
                if (entity.getWaktuSelesai() != null && now.isAfter(entity.getWaktuSelesai())) {
                    throw new RuntimeException("Waktu pelaksanaan ujian ini telah berakhir (Selesai pada jam " +
                            entity.getWaktuSelesai().format(dtf) + " WIB).");
                }
            }
        }

        if (isValid && userId != null) {
            var siswa = getOrCreateSiswaForUser(userId);

            com.baknusbelajar.api.entity.SiswaUjianStatus status = siswaUjianStatusRepository
                    .findBySiswaIdAndUjianMapelId(siswa.getId(), ujianId)
                    .orElseGet(() -> {
                        com.baknusbelajar.api.entity.SiswaUjianStatus newStatus = new com.baknusbelajar.api.entity.SiswaUjianStatus();
                        newStatus.setSiswa(siswa);
                        newStatus.setUjianMapel(entity);
                        return newStatus;
                    });

            if (status.getWaktuMulaiSiswa() == null || (entity.getWaktuMulai() != null && status.getWaktuMulaiSiswa().isBefore(entity.getWaktuMulai()))) {
                status.setWaktuMulaiSiswa(java.time.LocalDateTime.now());
                status.setStatusSelesai(false);
                status.setWaktuSelesai(null);
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
        if (dto.getTampilkanNilai() != null)
            entity.setTampilkanNilai(dto.getTampilkanNilai());
        if (dto.getStatusAktif() != null)
            entity.setStatusAktif(dto.getStatusAktif());
            
        if (dto.getToken() != null && !dto.getToken().isEmpty()) {
            entity.setToken(dto.getToken());
        }

        if (dto.getKelasIds() != null) {
            if (entity.getKelasList() == null) {
                entity.setKelasList(new java.util.HashSet<>());
            }
            entity.getKelasList().clear();
            if (!dto.getKelasIds().isEmpty()) {
                java.util.List<com.baknusbelajar.api.entity.Kelas> kelasList = kelasRepository.findAllById(dto.getKelasIds());
                entity.getKelasList().addAll(kelasList);
            }
        }

        return mapToDTO(ujianMapelRepository.save(entity), true);
    }

    public UjianMapelDTO toggleTampilkanNilai(Long id) {
        UjianMapel entity = ujianMapelRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ujian tidak ditemukan"));
        entity.setTampilkanNilai(entity.getTampilkanNilai() == null ? true : !entity.getTampilkanNilai());
        return mapToDTO(ujianMapelRepository.save(entity), true);
    }

    public UjianMapelDTO toggleStatusAktif(Long id) {
        UjianMapel entity = ujianMapelRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ujian tidak ditemukan"));
        boolean current = entity.getStatusAktif() != null ? entity.getStatusAktif() : true;
        entity.setStatusAktif(!current);
        UjianMapel saved = ujianMapelRepository.save(entity);
        log.info("Toggled statusAktif for ujian {}: {} -> {}", id, current, saved.getStatusAktif());
        return mapToDTO(saved, true);
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
        dto.setTampilkanNilai(entity.getTampilkanNilai() != null ? entity.getTampilkanNilai() : false);
        dto.setStatusAktif(entity.getStatusAktif() != null ? entity.getStatusAktif() : true);
        if (includeToken) {
            dto.setToken(entity.getToken());
        }

        if (entity.getEventUjian() != null) {
            dto.setEventId(entity.getEventUjian().getId());
            dto.setNamaEvent(entity.getEventUjian().getNamaEvent());
        }

        if (entity.getMapel() != null) {
            dto.setMapelId(entity.getMapel().getId());
            dto.setNamaMapel(entity.getMapel().getNamaMapel());
        }
        if (entity.getGuru() != null) {
            dto.setGuruId(entity.getGuru().getId());
            dto.setNamaGuru(entity.getGuru().getNamaLengkap());
        }
        
        if (entity.getJenisUjian() != null) {
            dto.setJenisUjian(entity.getJenisUjian().name());
        }
        if (entity.getPembuatGuru() != null) {
            dto.setPembuatGuruId(entity.getPembuatGuru().getId());
        }

        
        if (entity.getKelasList() != null && !entity.getKelasList().isEmpty()) {
            dto.setKelasIds(entity.getKelasList().stream().map(com.baknusbelajar.api.entity.Kelas::getId).collect(Collectors.toList()));
            dto.setNamaKelas(entity.getKelasList().stream().map(com.baknusbelajar.api.entity.Kelas::getNamaKelas).collect(Collectors.joining(", ")));
        } else {
            dto.setKelasIds(new java.util.ArrayList<>());
            dto.setNamaKelas("-");
        }
        
        return dto;
    }

    @org.springframework.transaction.annotation.Transactional
    public void resetUjianForStudent(Long ujianId, Long siswaId) {
        log.info("Resetting exam ID {} for student ID {}", ujianId, siswaId);

        // 1. Hapus record status pengerjaan siswa pada ujian ini
        siswaUjianStatusRepository.findBySiswaIdAndUjianMapelId(siswaId, ujianId).ifPresent(status -> {
            siswaUjianStatusRepository.delete(status);
        });

        // 2. Hapus seluruh jawaban PG siswa pada ujian ini
        var pgAnswers = jawabanPGRepository.findBySiswaIdAndSoalPG_UjianMapel_Id(siswaId, ujianId);
        if (pgAnswers != null && !pgAnswers.isEmpty()) {
            jawabanPGRepository.deleteAll(pgAnswers);
        }

        // 3. Hapus seluruh jawaban Essay siswa pada ujian ini
        var essayAnswers = jawabanSiswaRepository.findBySiswaIdAndSoalEssay_UjianMapel_Id(siswaId, ujianId);
        if (essayAnswers != null && !essayAnswers.isEmpty()) {
            jawabanSiswaRepository.deleteAll(essayAnswers);
        }

        // 4. Reset device lock dan sesi aktif di redis jika ada
        siswaRepository.findById(siswaId).ifPresent(siswa -> {
            if (siswa.getNisn() != null && examStatusService != null) {
                try {
                    examStatusService.resetPeserta(ujianId, siswa.getNisn());
                    examStatusService.removeStudent(ujianId, siswa.getNisn(), siswa.getNamaLengkap());
                } catch (Exception e) {
                    log.warn("Redis resetPeserta ignored: {}", e.getMessage());
                }
            }
        });

        log.info("Exam ID {} reset successfully for student ID {}", ujianId, siswaId);
    }

    @org.springframework.transaction.annotation.Transactional
    public void resetUjianForAllStudents(Long ujianId) {
        log.info("Resetting exam ID {} for all students", ujianId);

        var statuses = siswaUjianStatusRepository.findByUjianMapelId(ujianId);
        if (statuses != null && !statuses.isEmpty()) {
            siswaUjianStatusRepository.deleteAll(statuses);
        }

        var pgAnswers = jawabanPGRepository.findBySoalPG_UjianMapel_Id(ujianId);
        if (pgAnswers != null && !pgAnswers.isEmpty()) {
            jawabanPGRepository.deleteAll(pgAnswers);
        }

        var essayAnswers = jawabanSiswaRepository.findBySoalEssay_UjianMapel_Id(ujianId);
        if (essayAnswers != null && !essayAnswers.isEmpty()) {
            jawabanSiswaRepository.deleteAll(essayAnswers);
        }

        log.info("Exam ID {} reset successfully for all students", ujianId);
    }

    public com.baknusbelajar.api.dto.exam.ExamClassSummaryDTO getExamClassSummary(Long ujianId) {
        var monitoringList = getExamMonitoring(ujianId, null);
        UjianMapel ujian = ujianMapelRepository.findById(ujianId)
                .orElseThrow(() -> new RuntimeException("Ujian not found"));

        com.baknusbelajar.api.dto.exam.ExamClassSummaryDTO result = new com.baknusbelajar.api.dto.exam.ExamClassSummaryDTO();
        result.setUjianId(ujianId);
        result.setNamaMapel(ujian.getMapel() != null ? ujian.getMapel().getNamaMapel() : "-");
        result.setNamaGuru(ujian.getGuru() != null ? ujian.getGuru().getNamaLengkap() : "-");

        java.util.Map<String, java.util.List<com.baknusbelajar.api.dto.exam.ExamMonitoringDTO>> perClass = monitoringList.stream()
                .collect(Collectors.groupingBy(m -> m.getNamaKelas() != null ? m.getNamaKelas() : "Tanpa Kelas", java.util.LinkedHashMap::new, Collectors.toList()));

        java.util.List<com.baknusbelajar.api.dto.exam.ExamClassSummaryDTO.ClassSummaryItem> items = new java.util.ArrayList<>();
        int totalSiswa = monitoringList.size();
        int totalSelesai = 0;

        for (java.util.Map.Entry<String, java.util.List<com.baknusbelajar.api.dto.exam.ExamMonitoringDTO>> entry : perClass.entrySet()) {
            String namaKelas = entry.getKey();
            var students = entry.getValue();
            Long kelasId = students.isEmpty() ? null : students.get(0).getKelasId();
            int jmlSiswa = students.size();
            int jmlSelesai = (int) students.stream().filter(s -> Boolean.TRUE.equals(s.getIsFinished())).count();
            int jmlBelum = jmlSiswa - jmlSelesai;
            totalSelesai += jmlSelesai;

            items.add(new com.baknusbelajar.api.dto.exam.ExamClassSummaryDTO.ClassSummaryItem(kelasId, namaKelas, jmlSiswa, jmlSelesai, jmlBelum));
        }

        result.setTotalSiswa(totalSiswa);
        result.setTotalSelesai(totalSelesai);
        result.setTotalBelum(totalSiswa - totalSelesai);
        result.setKelasList(items);

        return result;
    }


    @org.springframework.transaction.annotation.Transactional
    public java.util.Map<String, Object> copyQuestions(Long targetUjianId, Long sourceUjianId) {
        log.info("Copying questions from source exam ID {} to target exam ID {}", sourceUjianId, targetUjianId);
        UjianMapel target = ujianMapelRepository.findById(targetUjianId)
                .orElseThrow(() -> new RuntimeException("Ujian target tidak ditemukan (ID: " + targetUjianId + ")"));
        UjianMapel source = ujianMapelRepository.findById(sourceUjianId)
                .orElseThrow(() -> new RuntimeException("Ujian sumber tidak ditemukan (ID: " + sourceUjianId + ")"));

        java.util.List<com.baknusbelajar.api.entity.SoalPG> sourcePG = soalPGRepository.findByUjianMapelId(sourceUjianId);
        java.util.List<com.baknusbelajar.api.entity.SoalEssay> sourceEssay = soalEssayRepository.findByUjianMapelId(sourceUjianId);

        if (sourcePG.isEmpty() && sourceEssay.isEmpty()) {
            throw new RuntimeException("Ujian sumber tidak memiliki soal untuk disalin.");
        }

        int copiedPG = 0;
        for (var spg : sourcePG) {
            var newPG = com.baknusbelajar.api.entity.SoalPG.builder()
                    .ujianMapel(target)
                    .pertanyaan(spg.getPertanyaan())
                    .pilihanA(spg.getPilihanA())
                    .pilihanB(spg.getPilihanB())
                    .pilihanC(spg.getPilihanC())
                    .pilihanD(spg.getPilihanD())
                    .pilihanE(spg.getPilihanE())
                    .kunciJawaban(spg.getKunciJawaban())
                    .bobotNilai(spg.getBobotNilai())
                    .tipeSoal(spg.getTipeSoal() != null ? spg.getTipeSoal() : "PG_BIASA")
                    .build();
            soalPGRepository.save(newPG);
            copiedPG++;
        }

        int copiedEssay = 0;
        for (var se : sourceEssay) {
            var newEssay = com.baknusbelajar.api.entity.SoalEssay.builder()
                    .ujianMapel(target)
                    .pertanyaan(se.getPertanyaan())
                    .kunciJawaban(se.getKunciJawaban())
                    .bobotNilai(se.getBobotNilai())
                    .build();
            soalEssayRepository.save(newEssay);
            copiedEssay++;
        }

        log.info("Successfully copied {} PG and {} Essay questions from exam {} to exam {}",
                copiedPG, copiedEssay, sourceUjianId, targetUjianId);

        java.util.Map<String, Object> resp = new java.util.HashMap<>();
        resp.put("success", true);
        resp.put("copiedPG", copiedPG);
        resp.put("copiedEssay", copiedEssay);
        resp.put("totalCopied", copiedPG + copiedEssay);
        resp.put("message", "Berhasil menyalin " + (copiedPG + copiedEssay) + " soal (" + copiedPG + " PG, " + copiedEssay + " Essay)");
        return resp;
    }

    public List<ExamPesertaDTO> getPesertaUjian(Long ujianId, Long kelasId, String statusFilter) {
        UjianMapel ujian = ujianMapelRepository.findById(ujianId)
                .orElseThrow(() -> new RuntimeException("Ujian tidak ditemukan (ID: " + ujianId + ")"));

        List<com.baknusbelajar.api.entity.Siswa> siswaList = new java.util.ArrayList<>();
        if (kelasId != null) {
            siswaList.addAll(siswaRepository.findByKelasId(kelasId));
        } else if (ujian.getKelasList() != null && !ujian.getKelasList().isEmpty()) {
            for (com.baknusbelajar.api.entity.Kelas k : ujian.getKelasList()) {
                siswaList.addAll(siswaRepository.findByKelasId(k.getId()));
            }
        } else if (ujian.getGuru() != null && ujian.getMapel() != null) {
            List<com.baknusbelajar.api.entity.GuruMapel> guruMapels = guruMapelRepository.findByGuruId(ujian.getGuru().getId())
                    .stream()
                    .filter(gm -> gm.getMapel() != null && gm.getMapel().getId().equals(ujian.getMapel().getId()))
                    .collect(Collectors.toList());
            for (com.baknusbelajar.api.entity.GuruMapel gm : guruMapels) {
                if (gm.getKelas() != null) {
                    siswaList.addAll(siswaRepository.findByKelasId(gm.getKelas().getId()));
                }
            }
        }

        // Deduplicate siswa
        Map<Long, com.baknusbelajar.api.entity.Siswa> distinctSiswa = siswaList.stream()
                .collect(Collectors.toMap(com.baknusbelajar.api.entity.Siswa::getId, s -> s, (s1, s2) -> s1, java.util.LinkedHashMap::new));

        // Batch load status & answers
        Map<Long, com.baknusbelajar.api.entity.SiswaUjianStatus> statusMap = siswaUjianStatusRepository.findByUjianMapelId(ujianId).stream()
                .filter(st -> st.getSiswa() != null)
                .collect(Collectors.toMap(st -> st.getSiswa().getId(), st -> st, (st1, st2) -> st1));

        // Pastikan siswa yang memiliki status ujian juga masuk jika belum ada di daftar
        for (com.baknusbelajar.api.entity.SiswaUjianStatus stRecord : statusMap.values()) {
            if (stRecord.getSiswa() != null && !distinctSiswa.containsKey(stRecord.getSiswa().getId())) {
                distinctSiswa.put(stRecord.getSiswa().getId(), stRecord.getSiswa());
            }
        }

        Map<Long, List<com.baknusbelajar.api.entity.JawabanPG>> pgMap = jawabanPGRepository.findBySoalPG_UjianMapel_Id(ujianId).stream()
                .filter(j -> j.getSiswa() != null)
                .collect(Collectors.groupingBy(j -> j.getSiswa().getId()));

        Map<Long, List<com.baknusbelajar.api.entity.JawabanSiswa>> essayMap = jawabanSiswaRepository.findBySoalEssay_UjianMapel_Id(ujianId).stream()
                .filter(j -> j.getSiswa() != null)
                .collect(Collectors.groupingBy(j -> j.getSiswa().getId()));

        Set<String> activeNisns = (examStatusService != null) ? examStatusService.getActiveStudents(ujianId, null) : Collections.emptySet();

        String normalizedStatusFilter = (statusFilter != null && !statusFilter.trim().isEmpty())
                ? statusFilter.trim().toUpperCase() : null;

        List<ExamPesertaDTO> result = new java.util.ArrayList<>();

        for (com.baknusbelajar.api.entity.Siswa siswa : distinctSiswa.values()) {
            com.baknusbelajar.api.entity.SiswaUjianStatus st = statusMap.get(siswa.getId());
            boolean isFinished = (st != null && Boolean.TRUE.equals(st.getStatusSelesai()));
            boolean isOnline = (siswa.getNisn() != null && activeNisns != null &&
                    activeNisns.stream().anyMatch(os -> os.startsWith(siswa.getNisn() + ":")));
            boolean hasStarted = (st != null && st.getWaktuMulaiSiswa() != null);

            String statusStr;
            Double nilai = null;
            java.time.LocalDateTime waktuMulai = null;
            java.time.LocalDateTime waktuSelesai = null;

            if (isFinished) {
                statusStr = "SUDAH";
                waktuMulai = st.getWaktuMulaiSiswa();
                waktuSelesai = st.getWaktuSelesai();

                double totalPg = pgMap.getOrDefault(siswa.getId(), Collections.emptyList()).stream()
                        .mapToDouble(p -> p.getSkor() != null ? p.getSkor() : 0.0).sum();
                double totalEssay = essayMap.getOrDefault(siswa.getId(), Collections.emptyList()).stream()
                        .mapToDouble(e -> e.getSkorFinalGuru() != null ? e.getSkorFinalGuru() : (e.getSkorAi() != null ? e.getSkorAi() : 0.0)).sum();

                nilai = Math.round((totalPg + totalEssay) * 10.0) / 10.0;
            } else if (hasStarted || isOnline) {
                statusStr = "SEDANG";
                waktuMulai = (st != null) ? st.getWaktuMulaiSiswa() : null;
            } else {
                statusStr = "BELUM";
            }

            // Filter check
            if (normalizedStatusFilter != null) {
                boolean match = false;
                if ((normalizedStatusFilter.equals("SUDAH") || normalizedStatusFilter.equals("SELESAI")) && statusStr.equals("SUDAH")) {
                    match = true;
                } else if ((normalizedStatusFilter.equals("SEDANG") || normalizedStatusFilter.equals("SEDANG_MENGERJAKAN")) && statusStr.equals("SEDANG")) {
                    match = true;
                } else if (normalizedStatusFilter.equals("BELUM") && statusStr.equals("BELUM")) {
                    match = true;
                }
                if (!match) {
                    continue;
                }
            }

            ExamPesertaDTO dto = ExamPesertaDTO.builder()
                    .siswaId(siswa.getId())
                    .nama(siswa.getNamaLengkap())
                    .nisn(siswa.getNisn())
                    .kelasId(siswa.getKelas() != null ? siswa.getKelas().getId() : null)
                    .namaKelas(siswa.getKelas() != null ? siswa.getKelas().getNamaKelas() : "-")
                    .status(statusStr)
                    .nilai(nilai)
                    .waktuMulai(waktuMulai)
                    .waktuSelesai(waktuSelesai)
                    .build();

            result.add(dto);
        }

        result.sort(Comparator.comparing(ExamPesertaDTO::getNama, String.CASE_INSENSITIVE_ORDER));
        return result;
    }

    
    public UjianMapelDTO getUjianById(Long id) {
        UjianMapel entity = ujianMapelRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ujian tidak ditemukan (ID: " + id + ")"));
        return mapToDTO(entity, true);
    }

    public byte[] exportPesertaExcel(Long ujianId, Long currentUserId, Collection<? extends GrantedAuthority> authorities) {
        UjianMapel ujian = ujianMapelRepository.findById(ujianId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ujian tidak ditemukan (ID: " + ujianId + ")"));

        // 1. Otorisasi: ADMIN, TU, atau CO_ADMIN boleh unduh semua ujian
        boolean isAdminOrTu = authorities != null && authorities.stream().anyMatch(a ->
                "ROLE_ADMIN".equals(a.getAuthority()) ||
                "ROLE_TU".equals(a.getAuthority()) ||
                "ROLE_CO_ADMIN".equals(a.getAuthority()));

        if (!isAdminOrTu) {
            Guru guru = guruRepository.findByUserId(currentUserId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Data profil guru tidak ditemukan"));

            boolean isCoAdmin = Boolean.TRUE.equals(guru.getIsCoAdmin());
            if (!isCoAdmin) {
                if (ujian.getGuru() == null || !ujian.getGuru().getId().equals(guru.getId())) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Akses ditolak: Anda hanya berhak mengunduh data rekap ujian untuk mata pelajaran yang Anda ampu.");
                }
            }
        }

        // 2. Ambil seluruh data peserta (SUDAH, SEDANG, BELUM)
        List<ExamPesertaDTO> pesertaList = getPesertaUjian(ujianId, null, null);

        // Urutkan berdasarkan: Kelas ASC, Nama Siswa ASC
        pesertaList.sort((a, b) -> {
            String k1 = a.getNamaKelas() != null ? a.getNamaKelas() : "";
            String k2 = b.getNamaKelas() != null ? b.getNamaKelas() : "";
            int compKelas = k1.compareToIgnoreCase(k2);
            if (compKelas != 0) return compKelas;
            String n1 = a.getNama() != null ? a.getNama() : "";
            String n2 = b.getNama() != null ? b.getNama() : "";
            return n1.compareToIgnoreCase(n2);
        });

        // 3. Hitung statistik
        int totalPeserta = pesertaList.size();
        long sudahSelesai = pesertaList.stream().filter(p -> "SUDAH".equalsIgnoreCase(p.getStatus())).count();
        long sedangMengerjakan = pesertaList.stream().filter(p -> "SEDANG".equalsIgnoreCase(p.getStatus())).count();
        long belumMengerjakan = pesertaList.stream().filter(p -> "BELUM".equalsIgnoreCase(p.getStatus())).count();
        double persenSelesai = totalPeserta > 0 ? (sudahSelesai * 100.0 / totalPeserta) : 0.0;

        // 4. Generate Workbook dengan Apache POI
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            String rawSheetName = ujian.getMapel() != null ? ujian.getMapel().getNamaMapel() : "Rekap_Ujian";
            String safeSheetName = WorkbookUtil.createSafeSheetName(rawSheetName);
            Sheet sheet = workbook.createSheet(safeSheetName);
            sheet.setDisplayGridlines(true);

            // Styling - Font
            Font fontTitle = workbook.createFont();
            fontTitle.setFontName("Arial");
            fontTitle.setFontHeightInPoints((short) 13);
            fontTitle.setBold(true);
            fontTitle.setColor(IndexedColors.DARK_BLUE.getIndex());

            Font fontSubtitle = workbook.createFont();
            fontSubtitle.setFontName("Arial");
            fontSubtitle.setFontHeightInPoints((short) 10);
            fontSubtitle.setBold(true);
            fontSubtitle.setColor(IndexedColors.GREY_50_PERCENT.getIndex());

            Font fontBold = workbook.createFont();
            fontBold.setFontName("Arial");
            fontBold.setFontHeightInPoints((short) 10);
            fontBold.setBold(true);

            Font fontRegular = workbook.createFont();
            fontRegular.setFontName("Arial");
            fontRegular.setFontHeightInPoints((short) 10);

            Font fontHeader = workbook.createFont();
            fontHeader.setFontName("Arial");
            fontHeader.setFontHeightInPoints((short) 10);
            fontHeader.setBold(true);
            fontHeader.setColor(IndexedColors.WHITE.getIndex());

            // Header Style
            CellStyle styleHeader = workbook.createCellStyle();
            styleHeader.setFont(fontHeader);
            styleHeader.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            styleHeader.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            styleHeader.setAlignment(HorizontalAlignment.CENTER);
            styleHeader.setVerticalAlignment(VerticalAlignment.CENTER);
            styleHeader.setBorderTop(BorderStyle.THIN);
            styleHeader.setBorderBottom(BorderStyle.THIN);
            styleHeader.setBorderLeft(BorderStyle.THIN);
            styleHeader.setBorderRight(BorderStyle.THIN);

            // Cell Styles
            CellStyle styleCenter = workbook.createCellStyle();
            styleCenter.setFont(fontRegular);
            styleCenter.setAlignment(HorizontalAlignment.CENTER);
            styleCenter.setVerticalAlignment(VerticalAlignment.CENTER);
            styleCenter.setBorderTop(BorderStyle.THIN);
            styleCenter.setBorderBottom(BorderStyle.THIN);
            styleCenter.setBorderLeft(BorderStyle.THIN);
            styleCenter.setBorderRight(BorderStyle.THIN);

            CellStyle styleLeft = workbook.createCellStyle();
            styleLeft.setFont(fontRegular);
            styleLeft.setAlignment(HorizontalAlignment.LEFT);
            styleLeft.setVerticalAlignment(VerticalAlignment.CENTER);
            styleLeft.setBorderTop(BorderStyle.THIN);
            styleLeft.setBorderBottom(BorderStyle.THIN);
            styleLeft.setBorderLeft(BorderStyle.THIN);
            styleLeft.setBorderRight(BorderStyle.THIN);

            CellStyle styleScore = workbook.createCellStyle();
            styleScore.setFont(fontBold);
            styleScore.setAlignment(HorizontalAlignment.CENTER);
            styleScore.setVerticalAlignment(VerticalAlignment.CENTER);
            styleScore.setBorderTop(BorderStyle.THIN);
            styleScore.setBorderBottom(BorderStyle.THIN);
            styleScore.setBorderLeft(BorderStyle.THIN);
            styleScore.setBorderRight(BorderStyle.THIN);

            // Status: SUDAH (Green)
            CellStyle styleSudah = workbook.createCellStyle();
            styleSudah.cloneStyleFrom(styleCenter);
            Font fontSudah = workbook.createFont();
            fontSudah.setFontName("Arial");
            fontSudah.setFontHeightInPoints((short) 10);
            fontSudah.setBold(true);
            fontSudah.setColor(IndexedColors.DARK_GREEN.getIndex());
            styleSudah.setFont(fontSudah);
            styleSudah.setFillForegroundColor(IndexedColors.LIGHT_GREEN.getIndex());
            styleSudah.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // Status: SEDANG (Yellow/Orange)
            CellStyle styleSedang = workbook.createCellStyle();
            styleSedang.cloneStyleFrom(styleCenter);
            Font fontSedang = workbook.createFont();
            fontSedang.setFontName("Arial");
            fontSedang.setFontHeightInPoints((short) 10);
            fontSedang.setBold(true);
            fontSedang.setColor(IndexedColors.DARK_YELLOW.getIndex());
            styleSedang.setFont(fontSedang);
            styleSedang.setFillForegroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
            styleSedang.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // Status: BELUM (Rose/Red)
            CellStyle styleBelum = workbook.createCellStyle();
            styleBelum.cloneStyleFrom(styleCenter);
            Font fontBelum = workbook.createFont();
            fontBelum.setFontName("Arial");
            fontBelum.setFontHeightInPoints((short) 10);
            fontBelum.setBold(true);
            fontBelum.setColor(IndexedColors.RED.getIndex());
            styleBelum.setFont(fontBelum);
            styleBelum.setFillForegroundColor(IndexedColors.ROSE.getIndex());
            styleBelum.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // Meta styles
            CellStyle styleTitle = workbook.createCellStyle();
            styleTitle.setFont(fontTitle);

            CellStyle styleSubtitle = workbook.createCellStyle();
            styleSubtitle.setFont(fontSubtitle);

            CellStyle styleMetaLabel = workbook.createCellStyle();
            styleMetaLabel.setFont(fontBold);

            CellStyle styleMetaVal = workbook.createCellStyle();
            styleMetaVal.setFont(fontRegular);

            // Row 0: Title
            Row r0 = sheet.createRow(0);
            Cell c0 = r0.createCell(0);
            c0.setCellValue("REKAPITULASI STATUS PENGERJAAN & NILAI UJIAN CBT");
            c0.setCellStyle(styleTitle);

            // Row 1: Subtitle
            Row r1 = sheet.createRow(1);
            Cell c1 = r1.createCell(0);
            c1.setCellValue("SMK BAKTI NUSANTARA 666");
            c1.setCellStyle(styleSubtitle);

            // Metadata info
            String eventName = ujian.getEventUjian() != null ? ujian.getEventUjian().getNamaEvent() : "-";
            String mapelName = ujian.getMapel() != null ? ujian.getMapel().getNamaMapel() : "-";
            String guruName = ujian.getGuru() != null ? ujian.getGuru().getNamaLengkap() : "-";
            String durasiStr = (ujian.getDurasi() != null && ujian.getDurasi() > 0) ? ujian.getDurasi() + " Menit" : "Tanpa Batas Waktu";
            String waktuMulaiStr = ujian.getWaktuMulai() != null ? ujian.getWaktuMulai().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")) : "-";
            String waktuSelesaiStr = ujian.getWaktuSelesai() != null ? ujian.getWaktuSelesai().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")) : "-";
            String exportTimeStr = java.time.LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")) + " WIB";

            String[][] meta = {
                    {"Mata Pelajaran", ": " + mapelName},
                    {"Event Ujian", ": " + eventName},
                    {"Guru Pengampu", ": " + guruName},
                    {"Waktu Pelaksanaan", ": " + waktuMulaiStr + " s/d " + waktuSelesaiStr + " (" + durasiStr + ")"},
                    {"Waktu Unduh Data", ": " + exportTimeStr}
            };

            for (int i = 0; i < meta.length; i++) {
                Row r = sheet.createRow(3 + i);
                Cell cL = r.createCell(0);
                cL.setCellValue(meta[i][0]);
                cL.setCellStyle(styleMetaLabel);

                Cell cV = r.createCell(1);
                cV.setCellValue(meta[i][1]);
                cV.setCellStyle(styleMetaVal);
            }

            // Summary Card Row (Row 9)
            Row rSummary = sheet.createRow(9);
            CellStyle styleSummaryBox = workbook.createCellStyle();
            styleSummaryBox.setFont(fontBold);
            styleSummaryBox.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            styleSummaryBox.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            styleSummaryBox.setBorderTop(BorderStyle.THIN);
            styleSummaryBox.setBorderBottom(BorderStyle.THIN);
            styleSummaryBox.setBorderLeft(BorderStyle.THIN);
            styleSummaryBox.setBorderRight(BorderStyle.THIN);

            Cell cSum = rSummary.createCell(0);
            cSum.setCellValue(String.format("RINGKASAN: Total Siswa: %d | Sudah Selesai: %d (%.1f%%) | Sedang Mengerjakan: %d | Belum Mengerjakan: %d",
                    totalPeserta, sudahSelesai, persenSelesai, sedangMengerjakan, belumMengerjakan));
            cSum.setCellStyle(styleSummaryBox);

            // Table Header (Row 11)
            Row headerRow = sheet.createRow(11);
            headerRow.setHeightInPoints(24);
            String[] headers = {
                    "No", "NISN", "Nama Lengkap Siswa", "Kelas", "Status Ujian",
                    "Nilai Akhir", "Waktu Mulai", "Waktu Selesai", "Durasi Pengerjaan"
            };
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(styleHeader);
            }

            // Data Rows (Row 12+)
            int rowIdx = 12;
            for (int i = 0; i < pesertaList.size(); i++) {
                ExamPesertaDTO p = pesertaList.get(i);
                Row row = sheet.createRow(rowIdx++);
                row.setHeightInPoints(19);

                // 0: No
                Cell cNo = row.createCell(0);
                cNo.setCellValue(i + 1);
                cNo.setCellStyle(styleCenter);

                // 1: NISN
                Cell cNisn = row.createCell(1);
                cNisn.setCellValue(p.getNisn() != null ? p.getNisn() : "-");
                cNisn.setCellStyle(styleCenter);

                // 2: Nama Lengkap
                Cell cNama = row.createCell(2);
                cNama.setCellValue(p.getNama() != null ? p.getNama() : "-");
                cNama.setCellStyle(styleLeft);

                // 3: Kelas
                Cell cKelas = row.createCell(3);
                cKelas.setCellValue(p.getNamaKelas() != null ? p.getNamaKelas() : "-");
                cKelas.setCellStyle(styleCenter);

                // 4: Status Ujian
                Cell cStatus = row.createCell(4);
                String st = p.getStatus() != null ? p.getStatus().toUpperCase() : "BELUM";
                if ("SUDAH".equals(st)) {
                    cStatus.setCellValue("SUDAH SELESAI");
                    cStatus.setCellStyle(styleSudah);
                } else if ("SEDANG".equals(st)) {
                    cStatus.setCellValue("SEDANG MENGERJAKAN");
                    cStatus.setCellStyle(styleSedang);
                } else {
                    cStatus.setCellValue("BELUM MENGERJAKAN");
                    cStatus.setCellStyle(styleBelum);
                }

                // 5: Nilai Akhir
                Cell cNilai = row.createCell(5);
                if ("SUDAH".equals(st) && p.getNilai() != null) {
                    cNilai.setCellValue(p.getNilai());
                } else {
                    cNilai.setCellValue("-");
                }
                cNilai.setCellStyle(styleScore);

                // 6: Waktu Mulai
                Cell cMul = row.createCell(6);
                if (p.getWaktuMulai() != null) {
                    cMul.setCellValue(p.getWaktuMulai().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")));
                } else {
                    cMul.setCellValue("-");
                }
                cMul.setCellStyle(styleCenter);

                // 7: Waktu Selesai
                Cell cSel = row.createCell(7);
                if (p.getWaktuSelesai() != null) {
                    cSel.setCellValue(p.getWaktuSelesai().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")));
                } else {
                    cSel.setCellValue("-");
                }
                cSel.setCellStyle(styleCenter);

                // 8: Durasi Pengerjaan
                Cell cDur = row.createCell(8);
                if (p.getWaktuMulai() != null && p.getWaktuSelesai() != null) {
                    long diffSeconds = java.time.Duration.between(p.getWaktuMulai(), p.getWaktuSelesai()).getSeconds();
                    if (diffSeconds >= 0) {
                        long m = diffSeconds / 60;
                        long s = diffSeconds % 60;
                        cDur.setCellValue(m + "m " + s + "s");
                    } else {
                        cDur.setCellValue("Selesai");
                    }
                } else if ("SUDAH".equals(st)) {
                    cDur.setCellValue("Selesai");
                } else if ("SEDANG".equals(st)) {
                    cDur.setCellValue("Pengerjaan");
                } else {
                    cDur.setCellValue("-");
                }
                cDur.setCellStyle(styleCenter);
            }

            // Auto-size columns with padding
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                int currentWidth = sheet.getColumnWidth(i);
                sheet.setColumnWidth(i, Math.max(currentWidth + 1200, 3000));
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Error generating Excel for UjianMapel id={}: ", ujianId, e);
            throw new RuntimeException("Gagal membuat file Excel: " + e.getMessage());
        }
    }


    @CacheEvict(value = {"soalPGCache", "soalEssayCache"}, allEntries = true)
    @Transactional
    public void clearAllSoal(Long ujianId) {
        log.info("[UjianMapelService] Clearing all questions for Ujian ID: {}", ujianId);
        List<com.baknusbelajar.api.entity.SoalPG> pgList = soalPGRepository.findByUjianMapelId(ujianId);
        for (var pg : pgList) {
            try {
                jawabanPGRepository.deleteBySoalPGId(pg.getId());
            } catch (Exception e) {
                log.warn("[UjianMapelService] deleteBySoalPGId error: {}", e.getMessage());
            }
        }
        if (!pgList.isEmpty()) {
            soalPGRepository.deleteAll(pgList);
        }

        List<com.baknusbelajar.api.entity.SoalEssay> essayList = soalEssayRepository.findByUjianMapelId(ujianId);
        for (var essay : essayList) {
            try {
                jawabanSiswaRepository.deleteBySoalEssayId(essay.getId());
            } catch (Exception e) {
                log.warn("[UjianMapelService] deleteBySoalEssayId error: {}", e.getMessage());
            }
        }
        if (!essayList.isEmpty()) {
            soalEssayRepository.deleteAll(essayList);
        }
        log.info("[UjianMapelService] Cleared {} PG and {} Essay questions for Ujian ID: {}", pgList.size(), essayList.size(), ujianId);
    }
}
