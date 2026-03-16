package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.BabAttendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BabAttendanceRepository extends JpaRepository<BabAttendance, Long> {
    List<BabAttendance> findByBabId(Long babId);

    Optional<BabAttendance> findByBabIdAndSiswaId(Long babId, Long siswaId);

    boolean existsByBabIdAndSiswaId(Long babId, Long siswaId);
}
