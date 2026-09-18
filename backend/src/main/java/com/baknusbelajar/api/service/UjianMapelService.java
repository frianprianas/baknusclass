package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.exam.UjianMapelDTO;
import com.baknusbelajar.api.entity.EventUjian;
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

import java.util.*;
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

    public List<UjianMapelDTO> getUjianForStudent(Long eventId, Long userId) {
        var siswa = siswaRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Siswa record not found"));

        java.util.Map<String, com.baknusbelajar.api.entity.UjianMapel> distinctMap = new java.util.LinkedHashMap<>();
        java.util.Set<Long> seenIds = new java.util.HashSet<>();
        for (com.baknusbelajar.api.entity.UjianMapel e : ujianMapelRepository.findByEventAndStudent(eventId, siswa.getId())) {
            if (e == null || e.getId() == null || seenIds.contains(e.getId())) continue;
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

        String actualToken = entity.getToken() != null ? entity.getToken().trim() : "";
        if (actualToken.isEmpty()) {
            actualToken = generateRandomToken();
            entity.setToken(actualToken);
            ujianMapelRepository.save(entity);
        }

        String submittedToken = token != null ? token.trim() : "";
        boolean isValid = !submittedToken.isEmpty() && actualToken.equalsIgnoreCase(submittedToken);

        if (isValid && userId != null) {
            var siswa = siswaRepository.findByUserId(userId)
                    .orElseThrow(() -> new RuntimeException("Siswa record not found"));

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
}
