package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.EventUjian;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EventUjianRepository extends JpaRepository<EventUjian, Long> {
    Optional<EventUjian> findByStatusAktifTrue();

    long countByStatusAktifTrue();
}
