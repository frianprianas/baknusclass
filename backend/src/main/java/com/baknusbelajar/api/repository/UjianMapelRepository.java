package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.UjianMapel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UjianMapelRepository extends JpaRepository<UjianMapel, Long> {
    List<UjianMapel> findByEventUjianId(Long eventId);

    List<UjianMapel> findByGuruMapelId(Long guruMapelId);

    List<UjianMapel> findByEventUjianIdAndGuruMapelKelasId(Long eventId, Long kelasId);
}
