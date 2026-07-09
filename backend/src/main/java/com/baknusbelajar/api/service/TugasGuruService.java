package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.GradeTugasRequest;
import com.baknusbelajar.api.dto.TugasGuruRequest;
import com.baknusbelajar.api.entity.GuruMapel;
import com.baknusbelajar.api.entity.TugasGuru;
import com.baknusbelajar.api.entity.TugasSiswa;
import com.baknusbelajar.api.repository.GuruMapelRepository;
import com.baknusbelajar.api.repository.TugasGuruRepository;
import com.baknusbelajar.api.repository.TugasSiswaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TugasGuruService {

    private final TugasGuruRepository tugasGuruRepository;
    private final GuruMapelRepository guruMapelRepository;
    private final TugasSiswaRepository tugasSiswaRepository;

    @Transactional
    public TugasGuru createTugas(TugasGuruRequest request) {
        GuruMapel guruMapel = guruMapelRepository.findById(request.getGuruMapelId())
                .orElseThrow(() -> new RuntimeException("GuruMapel not found"));

        TugasGuru tugasGuru = TugasGuru.builder()
                .guruMapel(guruMapel)
                .judulTugas(request.getJudulTugas())
                .deskripsi(request.getDeskripsi())
                .batasWaktu(request.getBatasWaktu())
                .build();

        return tugasGuruRepository.save(tugasGuru);
    }

    public List<TugasGuru> getTugasByGuruMapel(Long guruMapelId) {
        return tugasGuruRepository.findByGuruMapelId(guruMapelId);
    }

    @Transactional
    public TugasSiswa gradeTugas(GradeTugasRequest request) {
        TugasSiswa tugasSiswa = tugasSiswaRepository.findById(request.getTugasSiswaId())
                .orElseThrow(() -> new RuntimeException("TugasSiswa not found"));

        tugasSiswa.setNilai(request.getNilai());
        tugasSiswa.setCatatanGuru(request.getCatatanGuru());

        return tugasSiswaRepository.save(tugasSiswa);
    }
}
