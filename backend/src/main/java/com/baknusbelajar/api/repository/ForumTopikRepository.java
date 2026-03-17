package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.ForumTopik;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ForumTopikRepository extends JpaRepository<ForumTopik, Long> {
    List<ForumTopik> findByGuruMapelIdOrderByPinnedDescCreatedAtDesc(Long guruMapelId);

    List<ForumTopik> findByGuruMapel_Kelas_IdOrderByPinnedDescCreatedAtDesc(Long kelasId);
}
