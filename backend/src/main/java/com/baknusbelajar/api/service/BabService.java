package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.materi.BabDTO;
import com.baknusbelajar.api.entity.Bab;
import com.baknusbelajar.api.entity.GuruMapel;
import com.baknusbelajar.api.entity.Siswa;
import com.baknusbelajar.api.repository.BabRepository;
import com.baknusbelajar.api.repository.GuruMapelRepository;
import com.baknusbelajar.api.repository.MateriRepository;
import com.baknusbelajar.api.repository.SiswaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BabService {

    private final BabRepository babRepository;
    private final GuruMapelRepository guruMapelRepository;
    private final MateriRepository materiRepository;
    private final SiswaRepository siswaRepository;
    private final com.baknusbelajar.api.repository.BabAttendanceRepository attendanceRepository;
    private final com.baknusbelajar.api.repository.BabQuestionRepository questionRepository;

    public List<BabDTO> getBabByGuruMapel(Long guruMapelId) {
        return babRepository.findByGuruMapelIdOrderByUrutanAsc(guruMapelId).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public List<BabDTO> getBabForStudent(String username) {
        Siswa siswa = siswaRepository.findByUserUsername(username)
                .orElseThrow(() -> new RuntimeException("Siswa tidak ditemukan"));

        if (siswa.getKelas() == null)
            return Collections.emptyList();

        List<GuruMapel> assignments = guruMapelRepository.findByKelasId(siswa.getKelas().getId());
        return assignments.stream()
                .flatMap(gm -> babRepository.findByGuruMapelIdOrderByUrutanAsc(gm.getId()).stream())
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public BabDTO createBab(BabDTO dto) {
        GuruMapel gm = guruMapelRepository.findById(dto.getGuruMapelId())
                .orElseThrow(() -> new RuntimeException("Penugasan Guru Mapel tidak ditemukan"));

        Bab bab = Bab.builder()
                .namaBab(dto.getNamaBab())
                .prolog(dto.getProlog())
                .urutan(dto.getUrutan())
                .guruMapel(gm)
                .deadlineTugas(dto.getDeadlineTugas())
                .isDeadlineActive(dto.getIsDeadlineActive())
                .build();

        Bab saved = babRepository.save(bab);
        return convertToDTO(saved);
    }

    @Transactional
    public BabDTO updateBab(Long id, BabDTO dto) {
        Bab bab = babRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Bab tidak ditemukan"));

        bab.setNamaBab(dto.getNamaBab());
        bab.setProlog(dto.getProlog());
        bab.setUrutan(dto.getUrutan());
        bab.setDeadlineTugas(dto.getDeadlineTugas());
        bab.setIsDeadlineActive(dto.getIsDeadlineActive());

        Bab saved = babRepository.save(bab);
        return convertToDTO(saved);
    }

    @Transactional
    public void deleteBab(Long id) {
        Bab bab = babRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Bab tidak ditemukan"));

        // 1. Handle materials associated with this bab (set bab_id to null)
        materiRepository.findByBabId(id).forEach(m -> {
            m.setBab(null);
            materiRepository.save(m);
        });

        // 2. Delete associated attendance
        attendanceRepository.deleteAll(attendanceRepository.findByBabId(id));

        // 3. Delete associated questions
        questionRepository.deleteAll(questionRepository.findByBabIdOrderByAskedAtDesc(id));

        // 4. Delete the bab itself
        babRepository.delete(bab);
    }

    private BabDTO convertToDTO(Bab bab) {
        return BabDTO.builder()
                .id(bab.getId())
                .namaBab(bab.getNamaBab())
                .prolog(bab.getProlog())
                .urutan(bab.getUrutan())
                .guruMapelId(bab.getGuruMapel().getId())
                .deadlineTugas(bab.getDeadlineTugas())
                .isDeadlineActive(bab.getIsDeadlineActive())
                .build();
    }
}
