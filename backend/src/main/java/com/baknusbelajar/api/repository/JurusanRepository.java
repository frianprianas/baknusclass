package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.Jurusan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JurusanRepository extends JpaRepository<Jurusan, Long> {
}
