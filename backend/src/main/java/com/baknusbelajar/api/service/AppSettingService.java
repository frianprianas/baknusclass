package com.baknusbelajar.api.service;

import com.baknusbelajar.api.entity.AppSetting;
import com.baknusbelajar.api.repository.AppSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AppSettingService {

    private final AppSettingRepository appSettingRepository;

    public Map<String, String> getAllSettings() {
        List<AppSetting> settings = appSettingRepository.findAll();
        Map<String, String> map = new HashMap<>();
        for (AppSetting setting : settings) {
            map.put(setting.getConfigKey(), setting.getConfigValue());
        }
        return map;
    }

    public void updateSettings(Map<String, String> settingsMap) {
        settingsMap.forEach((key, value) -> {
            AppSetting setting = appSettingRepository.findById(key)
                    .orElse(new AppSetting(key, null));
            setting.setConfigValue(value);
            appSettingRepository.save(setting);
        });
    }

    public String getSettingValue(String key, String defaultValue) {
        return appSettingRepository.findById(key)
                .map(AppSetting::getConfigValue)
                .orElse(defaultValue);
    }
}
