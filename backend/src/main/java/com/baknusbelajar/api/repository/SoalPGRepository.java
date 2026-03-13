package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.SoalPG;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SoalPGRepository extends JpaRepository<SoalPG, Long> {
    List<SoalPG> findByUjianMapelId(Long ujianMapelId);
}
