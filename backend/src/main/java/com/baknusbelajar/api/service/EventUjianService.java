package com.baknusbelajar.api.service;

import com.baknusbelajar.api.entity.*;
import com.baknusbelajar.api.repository.EventUjianRepository;
import com.baknusbelajar.api.repository.GuruRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class EventUjianService {

    private final EventUjianRepository eventUjianRepository;
    private final GuruRepository guruRepository;
    private final BaknusDriveService baknusDriveService;
    private final com.baknusbelajar.api.repository.UjianMapelRepository ujianMapelRepository;
    private final com.baknusbelajar.api.repository.SoalEssayRepository soalEssayRepository;
    private final com.baknusbelajar.api.repository.SoalPGRepository soalPGRepository;
    private final com.baknusbelajar.api.repository.JawabanSiswaRepository jawabanSiswaRepository;
    private final com.baknusbelajar.api.repository.SiswaUjianStatusRepository siswaUjianStatusRepository;

    public List<com.baknusbelajar.api.dto.exam.EventUjianDTO> getAllEvent() {
        return eventUjianRepository.findAll().stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public com.baknusbelajar.api.dto.exam.EventUjianDTO getEventById(Long id) {
        return eventUjianRepository.findById(id).map(this::mapToDTO)
                .orElseThrow(() -> new RuntimeException("Event Ujian not found"));
    }

    public com.baknusbelajar.api.dto.exam.EventUjianDTO getActiveEvent() {
        return eventUjianRepository.findByStatusAktifTrue().map(this::mapToDTO)
                .orElseThrow(() -> new RuntimeException("No active Event Ujian found"));
    }

    public com.baknusbelajar.api.dto.exam.EventUjianDTO createEvent(com.baknusbelajar.api.dto.exam.EventUjianDTO dto) {
        // If creating a new active event, optionally deactivate others here if business
        // logic requires 1 active event
        EventUjian entity = new EventUjian();
        entity.setNamaEvent(dto.getNamaEvent());
        entity.setSemester(dto.getSemester());
        entity.setTahunAjaran(dto.getTahunAjaran());
        entity.setTanggalMulai(dto.getTanggalMulai());
        entity.setTanggalSelesai(dto.getTanggalSelesai());
        entity.setStatusAktif(dto.getStatusAktif() != null ? dto.getStatusAktif() : true);

        if (dto.getProktorIds() != null && !dto.getProktorIds().isEmpty()) {
            java.util.List<com.baknusbelajar.api.entity.Guru> proktors = guruRepository
                    .findAllById(dto.getProktorIds());
            entity.setProktors(new java.util.HashSet<>(proktors));
        }

        EventUjian saved = eventUjianRepository.save(entity);

        // Notify BaknusDrive
        try {
            baknusDriveService.createEventFolder(saved.getNamaEvent());
        } catch (Exception e) {
            log.error("Failed to create folder in BaknusDrive for event {}: {}", saved.getNamaEvent(), e.getMessage());
        }

        return mapToDTO(saved);
    }

    public com.baknusbelajar.api.dto.exam.EventUjianDTO updateEvent(Long id,
            com.baknusbelajar.api.dto.exam.EventUjianDTO dto) {
        EventUjian entity = eventUjianRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Event Ujian not found"));
        entity.setNamaEvent(dto.getNamaEvent());
        entity.setSemester(dto.getSemester());
        entity.setTahunAjaran(dto.getTahunAjaran());
        entity.setTanggalMulai(dto.getTanggalMulai());
        entity.setTanggalSelesai(dto.getTanggalSelesai());
        if (dto.getStatusAktif() != null) {
            entity.setStatusAktif(dto.getStatusAktif());
        }

        if (dto.getProktorIds() != null) {
            java.util.List<com.baknusbelajar.api.entity.Guru> proktors = guruRepository
                    .findAllById(dto.getProktorIds());
            entity.setProktors(new java.util.HashSet<>(proktors));
        }

        return mapToDTO(eventUjianRepository.save(entity));
    }

    @org.springframework.transaction.annotation.Transactional
    public void deleteEvent(Long id, boolean force) {
        EventUjian entity = eventUjianRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Event Ujian not found"));

        if (!force) {
            long count = ujianMapelRepository.findByEventUjianId(id).size();
            if (count > 0) {
                throw new RuntimeException("CONTAINS_DATA|" + count);
            }
        } else {
            // Forced delete: Clean up all children
            List<UjianMapel> ujianList = ujianMapelRepository.findByEventUjianId(id);
            for (UjianMapel ujian : ujianList) {
                // Delete answers linked to essay questions for this exam
                List<JawabanSiswa> jawabanList = jawabanSiswaRepository.findBySoalEssay_UjianMapel_Id(ujian.getId());
                if (!jawabanList.isEmpty()) {
                    jawabanSiswaRepository.deleteAll(jawabanList);
                }

                // Delete student statuses for this exam
                List<SiswaUjianStatus> statusList = siswaUjianStatusRepository.findByUjianMapelId(ujian.getId());
                if (!statusList.isEmpty()) {
                    siswaUjianStatusRepository.deleteAll(statusList);
                }

                // Delete questions
                List<SoalEssay> essayList = soalEssayRepository.findByUjianMapelId(ujian.getId());
                if (!essayList.isEmpty()) {
                    soalEssayRepository.deleteAll(essayList);
                }

                List<SoalPG> pgList = soalPGRepository.findByUjianMapelId(ujian.getId());
                if (!pgList.isEmpty()) {
                    soalPGRepository.deleteAll(pgList);
                }

                // Finally delete the exam schedule itself
                ujianMapelRepository.delete(ujian);
            }
        }

        // Manual cleanup for proktors link table if needed
        entity.getProktors().clear();
        eventUjianRepository.save(entity);

        eventUjianRepository.deleteById(id);
    }

    public com.baknusbelajar.api.dto.exam.EventUjianDTO toggleEventStatus(Long id) {
        EventUjian entity = eventUjianRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Event Ujian not found"));
        entity.setStatusAktif(!entity.getStatusAktif());
        return mapToDTO(eventUjianRepository.save(entity));
    }

    public void deleteAllEvents() {
        List<EventUjian> allEvents = eventUjianRepository.findAll();
        for (EventUjian ev : allEvents) {
            deleteEvent(ev.getId(), true);
        }
    }

    private com.baknusbelajar.api.dto.exam.EventUjianDTO mapToDTO(EventUjian entity) {
        com.baknusbelajar.api.dto.exam.EventUjianDTO dto = new com.baknusbelajar.api.dto.exam.EventUjianDTO();
        dto.setId(entity.getId());
        dto.setNamaEvent(entity.getNamaEvent());
        dto.setSemester(entity.getSemester());
        dto.setTahunAjaran(entity.getTahunAjaran());
        dto.setTanggalMulai(entity.getTanggalMulai());
        dto.setTanggalSelesai(entity.getTanggalSelesai());
        dto.setStatusAktif(entity.getStatusAktif());
        if (entity.getProktors() != null) {
            dto.setProktorIds(entity.getProktors().stream()
                    .map(com.baknusbelajar.api.entity.Guru::getId)
                    .collect(Collectors.toList()));
        }
        return dto;
    }
}
