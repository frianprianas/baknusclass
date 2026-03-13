package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.Guru;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GuruRepository extends JpaRepository<Guru, Long> {
    Optional<Guru> findByNip(String nip);

    Optional<Guru> findByUserId(Long userId);
}
