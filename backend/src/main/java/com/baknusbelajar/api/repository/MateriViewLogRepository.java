package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.MateriViewLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface MateriViewLogRepository extends JpaRepository<MateriViewLog, Long> {
    Optional<MateriViewLog> findByMateriIdAndSiswaId(Long materiId, Long siswaId);

    List<MateriViewLog> findByMateriGuruMapelGuruUserUsername(String teacherUsername);

    List<MateriViewLog> findByMateriId(Long materiId);
}
