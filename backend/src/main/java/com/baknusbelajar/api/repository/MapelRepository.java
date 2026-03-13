package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.Mapel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MapelRepository extends JpaRepository<Mapel, Long> {
}
