package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.SiswaUjianStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SiswaUjianStatusRepository extends JpaRepository<SiswaUjianStatus, Long> {
    java.util.List<SiswaUjianStatus> findByUjianMapelId(Long ujianMapelId);

    Optional<SiswaUjianStatus> findBySiswaIdAndUjianMapelId(Long siswaId, Long ujianMapelId);
}
