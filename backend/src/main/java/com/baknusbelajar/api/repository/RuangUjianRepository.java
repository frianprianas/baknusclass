package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.RuangUjian;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RuangUjianRepository extends JpaRepository<RuangUjian, Long> {
}
