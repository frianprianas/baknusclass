package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.AppSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AppSettingRepository extends JpaRepository<AppSetting, String> {
}
