package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.materi.BabQuestionDTO;
import com.baknusbelajar.api.entity.Bab;
import com.baknusbelajar.api.entity.BabQuestion;
import com.baknusbelajar.api.entity.Siswa;
import com.baknusbelajar.api.repository.BabQuestionRepository;
import com.baknusbelajar.api.repository.BabRepository;
import com.baknusbelajar.api.repository.SiswaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BabQuestionService {

    private final BabQuestionRepository babQuestionRepository;
    private final BabRepository babRepository;
    private final SiswaRepository siswaRepository;

    public List<BabQuestionDTO> getQuestionsByBab(Long babId) {
        return babQuestionRepository.findByBabIdOrderByAskedAtDesc(babId).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public BabQuestionDTO askQuestion(Long babId, String username, String question) {
        Bab bab = babRepository.findById(babId)
                .orElseThrow(() -> new RuntimeException("Bab tidak ditemukan"));
        Siswa siswa = siswaRepository.findByUserUsername(username)
                .orElseThrow(() -> new RuntimeException("Siswa tidak ditemukan"));

        BabQuestion bq = BabQuestion.builder()
                .bab(bab)
                .siswa(siswa)
                .pertanyaan(question)
                .build();

        return convertToDTO(babQuestionRepository.save(bq));
    }

    @Transactional
    public BabQuestionDTO answerQuestion(Long questionId, String answer) {
        BabQuestion bq = babQuestionRepository.findById(questionId)
                .orElseThrow(() -> new RuntimeException("Pertanyaan tidak ditemukan"));

        bq.setJawaban(answer);
        bq.setAnsweredAt(LocalDateTime.now());

        return convertToDTO(babQuestionRepository.save(bq));
    }

    private BabQuestionDTO convertToDTO(BabQuestion bq) {
        return BabQuestionDTO.builder()
                .id(bq.getId())
                .babId(bq.getBab().getId())
                .siswaId(bq.getSiswa().getId())
                .namaSiswa(bq.getSiswa().getNamaLengkap())
                .pertanyaan(bq.getPertanyaan())
                .jawaban(bq.getJawaban())
                .askedAt(bq.getAskedAt())
                .answeredAt(bq.getAnsweredAt())
                .build();
    }
}
