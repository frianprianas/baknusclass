package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.materi.MateriDTO;
import com.baknusbelajar.api.dto.materi.MateriViewLogDTO;
import com.baknusbelajar.api.entity.GuruMapel;
import com.baknusbelajar.api.entity.Materi;
import com.baknusbelajar.api.entity.Siswa;
import com.baknusbelajar.api.entity.MateriViewLog;
import com.baknusbelajar.api.repository.GuruMapelRepository;
import com.baknusbelajar.api.repository.MateriRepository;
import com.baknusbelajar.api.repository.SiswaRepository;
import com.baknusbelajar.api.repository.MateriViewLogRepository;
import com.baknusbelajar.api.repository.TugasSiswaRepository;
import com.baknusbelajar.api.repository.BabRepository;
import com.baknusbelajar.api.repository.UserRepository;
import com.baknusbelajar.api.entity.Users;
import com.baknusbelajar.api.entity.TugasSiswa;
import com.baknusbelajar.api.dto.materi.TugasSiswaDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Slf4j
@Service
@RequiredArgsConstructor
public class MateriService {

    private final MateriRepository materiRepository;
    private final GuruMapelRepository guruMapelRepository;
    private final SiswaRepository siswaRepository;
    private final MateriViewLogRepository viewLogRepository;
    private final BaknusDriveService driveService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final com.baknusbelajar.api.repository.BabRepository babRepository;
    private final TugasSiswaRepository tugasSiswaRepository;
    private final UserRepository userRepository;

    public com.baknusbelajar.api.entity.Materi getMateriEntity(Long id) {
        return materiRepository.findById(id).orElse(null);
    }

    public List<MateriDTO> getMyMateri(String username) {
        return materiRepository.findByGuruMapelGuruUserUsername(username).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public List<MateriDTO> getMaterialsForStudent(String username) {
        Siswa siswa = siswaRepository.findByUserUsername(username)
                .orElseThrow(() -> new RuntimeException("Data Siswa tidak ditemukan"));

        if (siswa.getKelas() == null)
            return java.util.Collections.emptyList();

        List<Materi> allMateriForClass = materiRepository.findByGuruMapelKelasId(siswa.getKelas().getId());

        return allMateriForClass.stream()
                .map(m -> {
                    MateriDTO dto = convertToDTO(m);
                    dto.setIsViewed(viewLogRepository.findByMateriIdAndSiswaId(m.getId(), siswa.getId()).isPresent());
                    return dto;
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public void logMateriView(Long materiId, String username) {
        Siswa siswa = siswaRepository.findByUserUsername(username)
                .orElseThrow(() -> new RuntimeException("Data Siswa tidak ditemukan"));

        if (viewLogRepository.findByMateriIdAndSiswaId(materiId, siswa.getId()).isEmpty()) {
            Materi materi = materiRepository.findById(materiId)
                    .orElseThrow(() -> new RuntimeException("Materi tidak ditemukan"));

            MateriViewLog log = MateriViewLog.builder()
                    .materi(materi)
                    .siswa(siswa)
                    .build();
            viewLogRepository.save(log);
        }
    }

    public List<MateriViewLogDTO> getTeacherNotifications(String teacherUsername) {
        return viewLogRepository.findByMateriGuruMapelGuruUserUsername(teacherUsername).stream()
                .map(log -> MateriViewLogDTO.builder()
                        .materiName(log.getMateri().getNamaMateri())
                        .siswaName(log.getSiswa().getNamaLengkap())
                        .viewedAt(log.getViewAt())
                        .build())
                .collect(Collectors.toList());
    }

    public List<MateriDTO> getMateriByAssignment(Long guruMapelId) {
        return materiRepository.findByGuruMapelId(guruMapelId).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public MateriDTO uploadMateri(Long guruMapelId, Long babId, String namaMateri, MultipartFile file) {
        GuruMapel gm = guruMapelRepository.findById(guruMapelId)
                .orElseThrow(() -> new RuntimeException("Penugasan Guru Mapel tidak ditemukan"));

        com.baknusbelajar.api.entity.Bab bab = null;
        if (babId != null) {
            bab = babRepository.findById(babId).orElse(null);
        }

        String teacherEmail = gm.getGuru().getUser().getEmail();
        String subjectName = gm.getMapel().getNamaMapel();
        String className = gm.getKelas() != null ? gm.getKelas().getNamaKelas() : "";

        log.info("Uploading materi to BaknusDrive for teacher email: {} with className: {}", teacherEmail, className);
        String driveResponse = driveService.uploadMateri(teacherEmail, subjectName, className, file);

        String finalLink = driveResponse;
        try {
            if (driveResponse != null && driveResponse.trim().startsWith("{")) {
                JsonNode node = objectMapper.readTree(driveResponse);
                if (node.has("file") && node.get("file").has("id")) {
                    Long fileId = node.get("file").get("id").asLong();
                    finalLink = "/api/materi/view/" + fileId;
                }
            }
        } catch (Exception e) {
            log.error("Error parsing drive response: {}", e.getMessage());
        }

        Materi materi = Materi.builder()
                .namaMateri(namaMateri)
                .fileName(file.getOriginalFilename())
                .fileType(file.getContentType())
                .driveLink(finalLink)
                .guruMapel(gm)
                .bab(bab)
                .build();

        Materi saved = materiRepository.save(materi);
        return convertToDTO(saved);
    }

    public ResponseEntity<byte[]> proxyDownload(Long driveFileId, boolean isDownload) {
        log.info("Proxying request (isDownload={}) for drive file ID: {}", isDownload, driveFileId);

        java.util.Optional<com.baknusbelajar.api.entity.Materi> materiOpt = materiRepository.findAll().stream()
                .filter(m -> m.getDriveLink() != null && m.getDriveLink().endsWith("/" + driveFileId))
                .findFirst();

        if (materiOpt.isEmpty()) {
            log.warn("Security alert: Attempt to download unauthorized drive file ID: {}", driveFileId);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        String actualFileName = materiOpt.get().getFileName();
        return driveService.downloadFileWithFilename(driveFileId, actualFileName, isDownload);
    }

    @Transactional
    public String uploadTugasSiswa(String studentUsername, String teacherEmail, String subjectName,
            Long babId, MultipartFile file) {
        String cleanEmail = teacherEmail != null ? teacherEmail.trim().toLowerCase() : "";
        String cleanSubject = subjectName != null ? subjectName.trim() : "";

        log.info("Processing task upload: student={}, target_teacher={}, subject={}",
                studentUsername, cleanEmail, cleanSubject);

        Siswa siswa = siswaRepository.findByUserUsername(studentUsername)
                .orElseThrow(() -> new RuntimeException("Data Siswa tidak ditemukan: " + studentUsername));

        com.baknusbelajar.api.entity.Bab bab = null;
        if (babId != null) {
            bab = babRepository.findById(babId)
                    .orElseThrow(() -> new RuntimeException("Bab tidak ditemukan"));

            // Check Deadline
            if (Boolean.TRUE.equals(bab.getIsDeadlineActive()) && bab.getDeadlineTugas() != null) {
                if (java.time.LocalDateTime.now().isAfter(bab.getDeadlineTugas())) {
                    throw new RuntimeException("Gagal: Batas waktu pengumpulan tugas untuk Bab ini (" +
                            bab.getDeadlineTugas()
                                    .format(java.time.format.DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"))
                            + ") telah berakhir.");
                }
            }
        }

        String link = driveService.uploadTugas(siswa.getUser().getEmail(), cleanEmail, cleanSubject, file);

        TugasSiswa tugas = TugasSiswa.builder()
                .siswa(siswa)
                .teacherEmail(cleanEmail)
                .subjectName(cleanSubject)
                .fileName(file.getOriginalFilename())
                .driveLink(link)
                .bab(bab)
                .build();
        tugasSiswaRepository.save(tugas);
        log.info("Successfully persisted assignment to DB for student: {}", siswa.getNamaLengkap());

        return link;
    }

    public List<TugasSiswaDTO> getStudentSubmissions(String teacherUsername, String subjectName) {
        Users teacher = userRepository.findByUsername(teacherUsername)
                .orElseThrow(() -> new RuntimeException("Data Guru tidak ditemukan: " + teacherUsername));

        String cleanEmail = teacher.getEmail() != null ? teacher.getEmail().trim().toLowerCase() : "";
        String cleanSubject = subjectName != null ? subjectName.trim() : "";

        log.debug("Querying submissions for email={} and subject={}", cleanEmail, cleanSubject);

        List<TugasSiswa> list;
        if (!cleanSubject.isEmpty()) {
            list = tugasSiswaRepository.findByTeacherEmailIgnoreCaseAndSubjectNameIgnoreCaseOrderBySubmittedAtDesc(
                    cleanEmail, cleanSubject);
        } else {
            list = tugasSiswaRepository.findByTeacherEmailIgnoreCaseOrderBySubmittedAtDesc(cleanEmail);
        }

        return list.stream().map(this::convertToTugasDTO).collect(Collectors.toList());
    }

    public List<TugasSiswaDTO> getStudentSubmissionsBySiswa(String studentUsername) {
        log.info("Fetching my-submissions for student: {}", studentUsername);
        List<TugasSiswa> list = tugasSiswaRepository.findBySiswaUserUsernameOrderBySubmittedAtDesc(studentUsername);
        log.info("Found {} submissions for student: {}", list.size(), studentUsername);
        return list.stream()
                .map(this::convertToTugasDTO)
                .collect(Collectors.toList());
    }

    private TugasSiswaDTO convertToTugasDTO(TugasSiswa t) {
        return TugasSiswaDTO.builder()
                .id(t.getId())
                .studentName(t.getSiswa().getNamaLengkap())
                .studentEmail(t.getSiswa().getUser().getEmail())
                .subjectName(t.getSubjectName())
                .fileName(t.getFileName())
                .driveLink(t.getDriveLink())
                .submittedAt(t.getSubmittedAt())
                .babId(t.getBab() != null ? t.getBab().getId() : null)
                .babName(t.getBab() != null ? t.getBab().getNamaBab() : "Lainnya")
                .build();
    }

    @Transactional
    public void deleteMateri(Long id, String username) {
        Materi m = materiRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Materi tidak ditemukan"));

        if (!m.getGuruMapel().getGuru().getUser().getUsername().equals(username)) {
            throw new RuntimeException("Anda tidak memiliki akses untuk menghapus materi ini");
        }

        // 1. Delete associated view logs first (foreign key constraint)
        List<com.baknusbelajar.api.entity.MateriViewLog> logs = viewLogRepository.findByMateriId(id);
        viewLogRepository.deleteAll(logs);

        // 2. Delete from database
        materiRepository.delete(m);
    }

    private MateriDTO convertToDTO(Materi m) {
        return MateriDTO.builder()
                .id(m.getId())
                .namaMateri(m.getNamaMateri())
                .fileName(m.getFileName())
                .fileType(m.getFileType())
                .driveLink(m.getDriveLink())
                .guruMapelId(m.getGuruMapel().getId())
                .namaMapel(m.getGuruMapel().getMapel().getNamaMapel())
                .namaKelas(m.getGuruMapel().getKelas() != null ? m.getGuruMapel().getKelas().getNamaKelas() : "-")
                .uploadedAt(m.getUploadedAt())
                .babId(m.getBab() != null ? m.getBab().getId() : null)
                .emailGuru(m.getGuruMapel().getGuru().getUser().getEmail())
                .build();
    }
}
