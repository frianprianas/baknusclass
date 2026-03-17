package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.forum.ForumKomentarDTO;
import com.baknusbelajar.api.dto.forum.ForumTopikDTO;
import com.baknusbelajar.api.entity.ForumKomentar;
import com.baknusbelajar.api.entity.ForumTopik;
import com.baknusbelajar.api.entity.GuruMapel;
import com.baknusbelajar.api.entity.Users;
import com.baknusbelajar.api.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import com.baknusbelajar.api.dto.forum.ForumWSMessage;

@Service
@RequiredArgsConstructor
public class ForumService {

        private final ForumTopikRepository forumTopikRepository;
        private final ForumKomentarRepository forumKomentarRepository;
        private final GuruMapelRepository guruMapelRepository;
        private final UserRepository userRepository;
        private final SimpMessagingTemplate messagingTemplate;

        public List<ForumTopikDTO> getTopikByGuruMapel(Long guruMapelId) {
                return forumTopikRepository.findByGuruMapelIdOrderByPinnedDescCreatedAtDesc(guruMapelId).stream()
                                .map(this::mapTopikToDTO)
                                .collect(Collectors.toList());
        }

        public List<ForumTopikDTO> getTopikByKelas(Long kelasId) {
                return forumTopikRepository.findByGuruMapel_Kelas_IdOrderByPinnedDescCreatedAtDesc(kelasId).stream()
                                .map(this::mapTopikToDTO)
                                .collect(Collectors.toList());
        }

        public ForumTopikDTO getTopikById(Long id) {
                return forumTopikRepository.findById(id)
                                .map(this::mapTopikToDTO)
                                .orElseThrow(() -> new RuntimeException("Topik tidak ditemukan"));
        }

        @Transactional
        public ForumTopikDTO createTopik(ForumTopikDTO dto) {
                GuruMapel gm = guruMapelRepository.findById(dto.getGuruMapelId())
                                .orElseThrow(() -> new RuntimeException("Guru Mapel tidak ditemukan"));

                ForumTopik topik = ForumTopik.builder()
                                .judul(dto.getJudul())
                                .konten(dto.getKonten())
                                .pinned(dto.getIsPinned() != null ? dto.getIsPinned() : false)
                                .guruMapel(gm)
                                .build();

                return mapTopikToDTO(forumTopikRepository.save(topik));
        }

        public List<ForumKomentarDTO> getKomentarByTopik(Long topikId) {
                return forumKomentarRepository.findByTopikIdOrderByCreatedAtAsc(topikId).stream()
                                .map(this::mapKomentarToDTO)
                                .collect(Collectors.toList());
        }

        @Transactional
        public ForumKomentarDTO postKomentar(ForumKomentarDTO dto) {
                ForumTopik topik = forumTopikRepository.findById(dto.getTopikId())
                                .orElseThrow(() -> new RuntimeException("Topik tidak ditemukan"));

                if (Boolean.TRUE.equals(topik.getClosed())) {
                        throw new RuntimeException("Diskusi ini telah ditutup oleh Guru.");
                }

                Users user = userRepository.findById(dto.getUserId())
                                .orElseThrow(() -> new RuntimeException("User tidak ditemukan"));

                ForumKomentar komentar = ForumKomentar.builder()
                                .topik(topik)
                                .user(user)
                                .isiKomentar(dto.getIsiKomentar())
                                .build();

                ForumKomentarDTO savedDto = mapKomentarToDTO(forumKomentarRepository.save(komentar));

                // Broadcast via WebSocket
                messagingTemplate.convertAndSend("/topic/forum/" + savedDto.getTopikId(),
                                ForumWSMessage.builder()
                                                .type("COMMENT")
                                                .topikId(savedDto.getTopikId())
                                                .userId(savedDto.getUserId())
                                                .namaUser(savedDto.getNamaUser())
                                                .data(savedDto)
                                                .build());

                return savedDto;
        }

        @Transactional
        public ForumTopikDTO togglePin(Long id) {
                ForumTopik topik = forumTopikRepository.findById(id)
                                .orElseThrow(() -> new RuntimeException("Topik tidak ditemukan"));

                topik.setPinned(topik.getPinned() == null ? true : !topik.getPinned());
                ForumTopikDTO savedDto = mapTopikToDTO(forumTopikRepository.save(topik));

                // Broadcast pin change
                messagingTemplate.convertAndSend("/topic/forum/" + id,
                                ForumWSMessage.builder()
                                                .type("PIN_CHANGE")
                                                .topikId(id)
                                                .data(savedDto)
                                                .build());

                return savedDto;
        }

        @Transactional
        public ForumTopikDTO toggleClosed(Long id) {
                ForumTopik topik = forumTopikRepository.findById(id)
                                .orElseThrow(() -> new RuntimeException("Topik tidak ditemukan"));

                topik.setClosed(topik.getClosed() == null ? true : !topik.getClosed());
                ForumTopikDTO savedDto = mapTopikToDTO(forumTopikRepository.save(topik));

                // Broadcast closed status change
                messagingTemplate.convertAndSend("/topic/forum/" + id,
                                ForumWSMessage.builder()
                                                .type("CLOSED_CHANGE")
                                                .topikId(id)
                                                .data(savedDto)
                                                .build());

                return savedDto;
        }

        @Transactional
        public void deleteTopik(Long id) {
                // Delete comments first or rely on cascade if configured (not configured here,
                // doing manual delete)
                List<ForumKomentar> comments = forumKomentarRepository.findByTopikIdOrderByCreatedAtAsc(id);
                forumKomentarRepository.deleteAll(comments);
                forumTopikRepository.deleteById(id);
        }

        private ForumTopikDTO mapTopikToDTO(ForumTopik t) {
                return ForumTopikDTO.builder()
                                .id(t.getId())
                                .judul(t.getJudul())
                                .isPinned(t.getPinned() != null && t.getPinned())
                                .isClosed(t.getClosed() != null && t.getClosed())
                                .konten(t.getKonten())
                                .guruMapelId(t.getGuruMapel().getId())
                                .namaGuru(t.getGuruMapel().getGuru().getNamaLengkap())
                                .namaMapel(t.getGuruMapel().getMapel().getNamaMapel())
                                .namaKelas(t.getGuruMapel().getKelas() != null
                                                ? t.getGuruMapel().getKelas().getNamaKelas()
                                                : "-")
                                .createdAt(t.getCreatedAt())
                                .updatedAt(t.getUpdatedAt())
                                // In a real app we might use a count query, but for simplicity:
                                .jumlahKomentar((long) forumKomentarRepository
                                                .findByTopikIdOrderByCreatedAtAsc(t.getId()).size())
                                .build();
        }

        private ForumKomentarDTO mapKomentarToDTO(ForumKomentar k) {
                return ForumKomentarDTO.builder()
                                .id(k.getId())
                                .topikId(k.getTopik().getId())
                                .userId(k.getUser().getId())
                                .namaUser(k.getUser().getNamaLengkap())
                                .roleUser(k.getUser().getRole())
                                .isiKomentar(k.getIsiKomentar())
                                .createdAt(k.getCreatedAt())
                                .build();
        }
}
