package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.Materi;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MateriRepository extends JpaRepository<Materi, Long> {
    List<Materi> findByGuruMapelId(Long guruMapelId);

    List<Materi> findByGuruMapelGuruUserUsername(String username);

    List<Materi> findByGuruMapelKelasId(Long kelasId);

    boolean existsByDriveLinkContaining(String part);

    List<Materi> findByBabId(Long babId);
}
