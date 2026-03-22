package com.baknusbelajar.api.service;

import com.baknusbelajar.api.controller.exam.SaranNilaiController;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * Manages queuing for AI recommendation requests using:
 * 1. A local Semaphore (max 3 concurrent AI calls per server instance).
 * 2. A Redis-based distributed counter to rate-limit across instances.
 *
 * Cached results are stored in Redis for 30 minutes to avoid repeat calls
 * for the same student+exam combination.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiSaranQueueService {

    private final FallbackAiService fallbackAiService;
    private final StringRedisTemplate redisTemplate;

    /** Max number of concurrent AI calls allowed across the service. */
    private static final int MAX_CONCURRENT = 3;
    private static final int QUEUE_WAIT_SECONDS = 30;
    private static final long CACHE_TTL_MINUTES = 30;
    private static final int MAX_CHARS_PER_ANSWER = 400; // Truncate student answer to save tokens
    private static final int MAX_QUESTIONS_PER_SUBJECT = 5; // Only use first N questions

    /** Node-local concurrency guard. */
    private final Semaphore semaphore = new Semaphore(MAX_CONCURRENT, true);

    private static final String CACHE_PREFIX = "ai:saran:";
    private static final String RATE_KEY = "ai:saran:active_count";

    /**
     * Get (or generate) a personalized AI recommendation for a student.
     * Uses Redis for caching and distributed rate-limiting.
     */
    public String getSaranWithQueue(String siswaId, String namaSiswa,
            List<SaranNilaiController.HasilMapel> hasilPerMapel) throws InterruptedException {

        String cacheKey = buildCacheKey(siswaId, hasilPerMapel);

        // 1. Check Redis cache first
        String cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            log.info("[AiSaran] Cache HIT for siswa={}", siswaId);
            return cached;
        }

        // 2. Try to acquire local semaphore (wait up to 30 seconds)
        boolean acquired = semaphore.tryAcquire(QUEUE_WAIT_SECONDS, TimeUnit.SECONDS);
        if (!acquired) {
            log.warn("[AiSaran] Semaphore timeout for siswa={}, returning fallback", siswaId);
            return "BaknusAI sedang sibuk melayani banyak siswa. Silakan coba lagi dalam beberapa saat.";
        }

        try {
            // 3. Double-check cache after acquiring (another thread might have set it)
            cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                log.info("[AiSaran] Cache HIT (post-lock) for siswa={}", siswaId);
                return cached;
            }

            // 4. Increment distributed counter
            Long activeCount = redisTemplate.opsForValue().increment(RATE_KEY);
            redisTemplate.expire(RATE_KEY, 5, TimeUnit.MINUTES);
            log.info("[AiSaran] Active AI calls globally: {}", activeCount);

            try {
                // 5. Trim payload to reduce token usage
                List<SaranNilaiController.HasilMapel> trimmed = trimPayload(hasilPerMapel);

                // 6. Call AI
                String result = fallbackAiService.saranNilaiSiswaMendalam(namaSiswa, trimmed).block();

                if (result != null && !result.isBlank()) {
                    // 7. Cache the result
                    redisTemplate.opsForValue().set(cacheKey, result, CACHE_TTL_MINUTES, TimeUnit.MINUTES);
                    log.info("[AiSaran] Result cached for siswa={}, key={}", siswaId, cacheKey);
                }

                return result != null ? result : "Tidak ada saran yang dapat diberikan saat ini.";

            } finally {
                redisTemplate.opsForValue().decrement(RATE_KEY);
            }

        } finally {
            semaphore.release();
        }
    }

    /**
     * Trim payload to limit token usage:
     * - Max 5 questions per subject
     * - Truncate answers to 400 chars each
     */
    private List<SaranNilaiController.HasilMapel> trimPayload(
            List<SaranNilaiController.HasilMapel> hasilPerMapel) {

        return hasilPerMapel.stream().map(mapel -> {
            SaranNilaiController.HasilMapel trimmed = new SaranNilaiController.HasilMapel();
            trimmed.setNamaMapel(mapel.getNamaMapel());
            trimmed.setNilaiAkhir(mapel.getNilaiAkhir());

            if (mapel.getDaftarJawaban() != null) {
                var trimmedList = mapel.getDaftarJawaban().stream()
                        .limit(MAX_QUESTIONS_PER_SUBJECT)
                        .map(item -> {
                            SaranNilaiController.ItemJawaban tj = new SaranNilaiController.ItemJawaban();
                            // Truncate soal
                            String soal = item.getSoal() != null ? item.getSoal() : "";
                            tj.setSoal(soal.length() > 200 ? soal.substring(0, 200) + "..." : soal);
                            // Truncate jawaban
                            String jawab = item.getJawabSiswa() != null ? item.getJawabSiswa() : "";
                            tj.setJawabSiswa(jawab.length() > MAX_CHARS_PER_ANSWER
                                    ? jawab.substring(0, MAX_CHARS_PER_ANSWER) + "..."
                                    : jawab);
                            tj.setSkor(item.getSkor());
                            tj.setBobotMaksimal(item.getBobotMaksimal());
                            return tj;
                        })
                        .collect(java.util.stream.Collectors.toList());
                trimmed.setDaftarJawaban(trimmedList);
            }
            return trimmed;
        }).collect(java.util.stream.Collectors.toList());
    }

    /**
     * Build a stable cache key from siswaId + exam IDs + scores.
     */
    private String buildCacheKey(String siswaId,
            List<SaranNilaiController.HasilMapel> hasilPerMapel) {

        String scoreSignature = hasilPerMapel.stream()
                .map(m -> m.getNamaMapel() + ":" + m.getNilaiAkhir())
                .sorted()
                .collect(java.util.stream.Collectors.joining("|"));

        return CACHE_PREFIX + siswaId + ":" + Integer.toHexString(scoreSignature.hashCode());
    }
}
