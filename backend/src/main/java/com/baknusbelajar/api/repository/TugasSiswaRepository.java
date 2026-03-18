package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.TugasSiswa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TugasSiswaRepository extends JpaRepository<TugasSiswa, Long> {
    List<TugasSiswa> findByTeacherEmailIgnoreCaseOrderBySubmittedAtDesc(String teacherEmail);

    List<TugasSiswa> findByTeacherEmailIgnoreCaseAndSubjectNameIgnoreCaseOrderBySubmittedAtDesc(String teacherEmail,
            String subjectName);

    List<TugasSiswa> findBySiswaUserUsernameOrderBySubmittedAtDesc(String username);
}
