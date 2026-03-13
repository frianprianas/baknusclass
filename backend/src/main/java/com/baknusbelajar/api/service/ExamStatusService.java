package com.baknusbelajar.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamStatusService {

    private final StringRedisTemplate redisTemplate;
    private static final String EXAM_PRESENCE_KEY = "exam:presence:"; // exam:presence:{ujianId}
    private static final String EXAM_ROOM_PRESENCE_KEY = "exam:room:presence:"; // exam:room:presence:{ujianId}:{ruangId}

    /**
     * Mark a student as active in an exam.
     * Expire in 2 minutes to handle cases where student closes browser without
     * logout.
     */
    public void markAsActive(Long ujianId, String nisn, String namaSiswa, Long ruangId) {
        String key = EXAM_PRESENCE_KEY + ujianId;
        String value = nisn + ":" + namaSiswa;
        redisTemplate.opsForSet().add(key, value);
        redisTemplate.expire(key, 5, TimeUnit.MINUTES);

        if (ruangId != null) {
            String roomKey = EXAM_ROOM_PRESENCE_KEY + ujianId + ":" + ruangId;
            redisTemplate.opsForSet().add(roomKey, value);
            redisTemplate.expire(roomKey, 5, TimeUnit.MINUTES);
        }
    }

    public void checkAndLockDevice(Long ujianId, String nisn, String deviceId) {
        if (deviceId == null || deviceId.isEmpty())
            return;
        String deviceKey = "exam:device:" + ujianId + ":" + nisn;
        String currentDevice = redisTemplate.opsForValue().get(deviceKey);

        if (currentDevice != null && !currentDevice.equals(deviceId)) {
            throw new RuntimeException(
                    "Akun Anda sedang terhubung di perangkat / browser lain. Silakan minta Pengawas / Admin untuk Reset Login Peserta agar bisa melanjutkan di komputer ini.");
        }

        // Lock this device for 5 hours (safely covers exam length + some margin)
        redisTemplate.opsForValue().set(deviceKey, deviceId, 5, TimeUnit.HOURS);
    }

    public void resetPeserta(Long ujianId, String nisn) {
        String deviceKey = "exam:device:" + ujianId + ":" + nisn;
        redisTemplate.delete(deviceKey);
    }

    /**
     * Get list of active students for a specific exam.
     */
    public Set<String> getActiveStudents(Long ujianId, Long ruangId) {
        if (ruangId != null) {
            String roomKey = EXAM_ROOM_PRESENCE_KEY + ujianId + ":" + ruangId;
            return redisTemplate.opsForSet().members(roomKey);
        }
        String key = EXAM_PRESENCE_KEY + ujianId;
        return redisTemplate.opsForSet().members(key);
    }

    public void removeStudent(Long ujianId, String nisn, String namaSiswa) {
        String key = EXAM_PRESENCE_KEY + ujianId;
        String value = nisn + ":" + namaSiswa;
        redisTemplate.opsForSet().remove(key, value);
    }
}
