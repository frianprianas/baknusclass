package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.dashboard.DashboardSummaryDTO;
import com.baknusbelajar.api.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final SiswaRepository siswaRepository;
    private final GuruRepository guruRepository;
    private final JurusanRepository jurusanRepository;
    private final MapelRepository mapelRepository;
    private final EventUjianRepository eventUjianRepository;
    private final UjianMapelRepository ujianMapelRepository;
    private final JawabanSiswaRepository jawabanSiswaRepository;
    private final SiswaUjianStatusRepository statusRepository;
    private final UserRepository userRepository;

    public DashboardSummaryDTO getAdminSummary() {
        return DashboardSummaryDTO.builder()
                .totalSiswa(userRepository.countByRole("SISWA"))
                .totalGuru(userRepository.countByRole("GURU"))
                .totalJurusan(jurusanRepository.count())
                .totalMapel(mapelRepository.count())
                .totalUjianAktif(eventUjianRepository.countByStatusAktifTrue())
                .totalJawabanPerluReview(jawabanSiswaRepository.countBySkorFinalGuruIsNull())
                .sebaranNilaiSiswa(getRealSebaranDataForGuru(null))
                .aktivitasTerakhir(getRecentActivities(null))
                .build();
    }

    public DashboardSummaryDTO getGuruSummary(Long guruId) {
        return DashboardSummaryDTO.builder()
                .totalSiswa(userRepository.countByRole("SISWA"))
                .totalGuru(userRepository.countByRole("GURU"))
                .totalMapel(mapelRepository.count())
                .totalUjianAktif(ujianMapelRepository.countByGuruIdAndEventUjian_StatusAktifTrue(guruId))
                .totalJawabanPerluReview(jawabanSiswaRepository.countBySoalEssay_UjianMapel_Guru_IdAndSkorFinalGuruIsNull(guruId))
                .sebaranNilaiSiswa(getRealSebaranDataForGuru(guruId))
                .aktivitasTerakhir(getRecentActivities(guruId))
                .build();
    }

    private List<Map<String, Object>> getRealSebaranDataForGuru(Long guruId) {
        List<Double> scores;
        if (guruId == null) {
            scores = jawabanSiswaRepository.findAll().stream()
                .map(j -> j.getSkorFinalGuru() != null ? j.getSkorFinalGuru()
                        : (j.getSkorAi() != null ? j.getSkorAi() : 0.0))
                .collect(Collectors.toList());
        } else {
            scores = jawabanSiswaRepository.findBySoalEssay_UjianMapel_Guru_Id(guruId).stream()
                .map(j -> j.getSkorFinalGuru() != null ? j.getSkorFinalGuru()
                        : (j.getSkorAi() != null ? j.getSkorAi() : 0.0))
                .collect(Collectors.toList());
        }

        long excellent = scores.stream().filter(s -> s >= 80).count();
        long good = scores.stream().filter(s -> s >= 60 && s < 80).count();
        long poor = scores.stream().filter(s -> s < 60).count();

        return List.of(
                Map.of("range", "80-100", "count", (int) excellent),
                Map.of("range", "60-79", "count", (int) good),
                Map.of("range", "0-59", "count", (int) poor));
    }

    private List<Map<String, Object>> getRecentActivities(Long guruId) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd MMM, HH:mm");
        return statusRepository.findAll().stream()
                .filter(s -> guruId == null || (s.getUjianMapel() != null && s.getUjianMapel().getGuru() != null
                        && s.getUjianMapel().getGuru().getId().equals(guruId)))
                .sorted((a, b) -> {
                    if (a.getWaktuSelesai() == null && b.getWaktuSelesai() == null)
                        return 0;
                    if (a.getWaktuSelesai() == null)
                        return 1;
                    if (b.getWaktuSelesai() == null)
                        return -1;
                    return b.getWaktuSelesai().compareTo(a.getWaktuSelesai());
                })
                .limit(5)
                .map(s -> {
                    Map<String, Object> map = new java.util.HashMap<>();
                    map.put("user", s.getSiswa().getNamaLengkap());
                    map.put("action",
                            "Menyelesaikan Ujian: " + (s.getUjianMapel() != null && s.getUjianMapel().getMapel() != null ? s.getUjianMapel().getMapel().getNamaMapel() : "Ujian"));
                    map.put("date", s.getWaktuSelesai() != null ? s.getWaktuSelesai().format(formatter) : "Baru saja");
                    return map;
                })
                .collect(Collectors.toList());
    }
}
