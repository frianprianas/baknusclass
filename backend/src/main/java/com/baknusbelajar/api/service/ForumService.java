package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.forum.ForumKomentarDTO;
import com.baknusbelajar.api.dto.forum.ForumTopikDTO;
import com.baknusbelajar.api.entity.ForumKomentar;
import com.baknusbelajar.api.entity.ForumTopik;
import com.baknusbelajar.api.entity.GuruMapel;
import com.baknusbelajar.api.entity.Users;
import com.baknusbelajar.api.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import java.nio.charset.StandardCharsets;
import com.baknusbelajar.api.dto.forum.ForumWSMessage;
import com.baknusbelajar.api.dto.forum.ForumAnalysisDTO;

@Service
@RequiredArgsConstructor
@Slf4j
public class ForumService {

        private final ForumTopikRepository forumTopikRepository;
        private final ForumKomentarRepository forumKomentarRepository;
        private final GuruMapelRepository guruMapelRepository;
        private final UserRepository userRepository;
        private final SimpMessagingTemplate messagingTemplate;
        private final GeminiService geminiService;
        private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;
        private final BaknusDriveService baknusDriveService;

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
                                .namaGuruEmail(t.getGuruMapel().getGuru().getUser().getEmail())
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
                                .email(k.getUser().getEmail())
                                .createdAt(k.getCreatedAt())
                                .build();
        }

        public ForumAnalysisDTO analyzeForum(Long topikId) {
                ForumTopik topik = forumTopikRepository.findById(topikId)
                                .orElseThrow(() -> new RuntimeException("Topik tidak ditemukan"));

                // 1. Check Cache
                if (topik.getAiAnalysis() != null && !topik.getAiAnalysis().isBlank()) {
                        log.info("Returning cached AI analysis for topic ID: {}", topikId);
                        try {
                                ForumAnalysisDTO cached = objectMapper.readValue(topik.getAiAnalysis(),
                                                ForumAnalysisDTO.class);
                                cached.setTopikId(topikId);
                                return cached;
                        } catch (Exception e) {
                                log.warn("Failed to parse cached analysis, will re-analyze: {}", e.getMessage());
                        }
                }

                return performAiAnalysis(topik);
        }

        @Transactional
        public ForumAnalysisDTO forceAnalyzeForum(Long topikId) {
                ForumTopik topik = forumTopikRepository.findById(topikId)
                                .orElseThrow(() -> new RuntimeException("Topik tidak ditemukan"));
                return performAiAnalysis(topik);
        }

        private ForumAnalysisDTO performAiAnalysis(ForumTopik topik) {
                log.info("Starting AI analysis for forum topic ID: {}", topik.getId());
                List<ForumKomentar> komentarList = forumKomentarRepository
                                .findByTopikIdOrderByCreatedAtAsc(topik.getId());

                if (komentarList.isEmpty()) {
                        throw new RuntimeException("Belum ada interaksi (komentar) untuk dianalisis.");
                }

                StringBuilder transcript = new StringBuilder();
                for (ForumKomentar k : komentarList) {
                        transcript.append(String.format("[%s - %s]: %s\n",
                                        k.getUser().getNamaLengkap(),
                                        k.getUser().getRole(),
                                        k.getIsiKomentar()));
                }

                log.info("Transcript length: {} characters", transcript.length());

                String rawResult;
                try {
                        rawResult = geminiService
                                        .analyzeForum(topik.getJudul(), topik.getKonten(), transcript.toString())
                                        .block(java.time.Duration.ofSeconds(45));
                } catch (Exception e) {
                        log.error("AI service call failed: {}", e.getMessage());
                        throw new RuntimeException(
                                        "Layanan AI sedang sibuk atau tidak merespon. Silakan coba lagi nanti.");
                }

                if (rawResult == null || rawResult.trim().isEmpty()) {
                        log.error("AI returned null or empty result for topic: {}", topik.getId());
                        throw new RuntimeException("AI gagal memberikan hasil analisis (tidak ada respon).");
                }

                String jsonOnly = extractJson(rawResult);
                if (jsonOnly.isEmpty()) {
                        log.error("Failed to extract JSON from AI response: {}", rawResult);
                        throw new RuntimeException("Gagal mengolah format jawaban AI. Silakan coba lagi.");
                }

                try {
                        ForumAnalysisDTO dto = objectMapper.readValue(jsonOnly, ForumAnalysisDTO.class);
                        dto.setTopikId(topik.getId());
                        // Save to cache
                        topik.setAiAnalysis(jsonOnly);
                        forumTopikRepository.save(topik);
                        return dto;
                } catch (Exception e) {
                        log.error("Jackson parsing failed for JSON: {}", jsonOnly, e);
                        throw new RuntimeException("Gagal mengurai data analisis: " + e.getMessage());
                }
        }

        private String extractJson(String input) {
                String trimmed = input.trim();

                // Try matching ```json ... ```
                java.util.regex.Pattern p = java.util.regex.Pattern.compile("(?s)```json\\s*(.*?)\\s*```");
                java.util.regex.Matcher m = p.matcher(trimmed);
                if (m.find()) {
                        return m.group(1).trim();
                }

                // Try matching ``` ... ``` (any code block)
                p = java.util.regex.Pattern.compile("(?s)```\\s*(.*?)\\s*```");
                m = p.matcher(trimmed);
                if (m.find()) {
                        return m.group(1).trim();
                }

                // Try matching anything between { and }
                p = java.util.regex.Pattern.compile("(?s)(\\{.*\\})");
                m = p.matcher(trimmed);
                if (m.find()) {
                        return m.group(1).trim();
                }

                return trimmed;
        }

        public String saveAnalysisToDrive(Long topikId, ForumAnalysisDTO analysis) {
                ForumTopik topik = forumTopikRepository.findById(topikId)
                                .orElseThrow(() -> new RuntimeException("Topik tidak ditemukan"));

                String subjectName = topicsDisplayName(topik.getGuruMapel().getMapel().getNamaMapel());
                String className = topik.getGuruMapel().getKelas() != null
                                ? topik.getGuruMapel().getKelas().getNamaKelas()
                                : "Semua";
                String teacherEmail = topik.getGuruMapel().getGuru().getUser().getEmail();

                log.info("Saving analysis to drive for topic: '{}'. Email: {}, Subject: {}, Class: {}",
                                topik.getJudul(), teacherEmail, subjectName, className);

                if (teacherEmail == null) {
                        throw new RuntimeException("Email guru tidak ditemukan. Gagal menyimpan ke drive.");
                }

                StringBuilder sb = new StringBuilder();
                sb.append("HASIL ANALISIS BAKNUS AI\n");
                sb.append("========================\n\n");
                sb.append("Topik: ").append(topik.getJudul()).append("\n");
                sb.append("Mata Pelajaran: ").append(subjectName).append("\n");
                sb.append("Kelas: ").append(className).append("\n\n");

                sb.append("RINGKASAN:\n");
                sb.append(analysis.getRingkasan()).append("\n\n");

                sb.append("SISWA PALING AKTIF:\n");
                if (analysis.getUserPalingAktif() != null) {
                        for (var u : analysis.getUserPalingAktif()) {
                                sb.append("- ").append(u.getNama()).append(" (").append(u.getJumlahPesan())
                                                .append(" pesan)\n");
                        }
                }
                sb.append("\n");

                sb.append("KONTRIBUTOR TERBAIK:\n");
                if (analysis.getKontributorTerbaik() != null) {
                        for (var k : analysis.getKontributorTerbaik()) {
                                sb.append("- ").append(k.getNama()).append(": ").append(k.getAlasan()).append("\n");
                        }
                }

                String safeTitle = topik.getJudul().replaceAll("[^a-zA-Z0-9]", "_").toLowerCase();
                String fileName = "forum_" + safeTitle + "_hasilAI.txt";
                byte[] content = sb.toString().getBytes(StandardCharsets.UTF_8);

                return baknusDriveService.uploadMateriBytes(teacherEmail, subjectName, className, content, fileName);
        }

        private String topicsDisplayName(String name) {
                if (name == null)
                        return "Unknown";
                return name.replaceAll("[^a-zA-Z0-9 ]", "").trim();
        }
}
