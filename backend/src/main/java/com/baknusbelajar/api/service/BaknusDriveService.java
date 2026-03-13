package com.baknusbelajar.api.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class BaknusDriveService {

    @Value("${baknus-drive.url:https://baknusdrive.smkbn666.sch.id/api}")
    private String driveApiUrl;

    @Value("${baknus-drive.api-key:BAKNUS_CLASS_SECRET}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    // 1. Admin membuat Event (Ujian)
    public String createEventFolder(String eventName) {
        String url = driveApiUrl + "/class/create-event";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Class-API-Key", apiKey);

        // Using Map for cleaner JSON body construction
        java.util.Map<String, String> bodyMap = new java.util.HashMap<>();
        bodyMap.put("event_name", eventName);
        HttpEntity<java.util.Map<String, String>> entity = new HttpEntity<>(bodyMap, headers);

        try {
            System.out.println(">>> BaknusDriveService: Attempting to create event folder: " + eventName);
            log.info("Creating event folder in BaknusDrive. Event: {}", eventName);
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            log.info("BaknusDrive Create Event Response: {} - {}", response.getStatusCode(), response.getBody());
            System.out.println(">>> BaknusDriveService Response: " + response.getBody());
            return response.getBody();
        } catch (Exception e) {
            log.error("Error creating event folder in BaknusDrive: {}", e.getMessage());
            return "Error: " + e.getMessage();
        }
    }

    // 2. Guru membuat Jadwal Ujian (Opsi: Buat Folder Mapel)
    public String createSubjectFolder(String eventName, String subjectName) {
        String url = driveApiUrl + "/class/create-subject";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Class-API-Key", apiKey);

        java.util.Map<String, String> bodyMap = new java.util.HashMap<>();
        bodyMap.put("event_name", eventName);
        bodyMap.put("subject_name", subjectName);
        HttpEntity<java.util.Map<String, String>> entity = new HttpEntity<>(bodyMap, headers);

        try {
            log.info("Creating subject folder in BaknusDrive. Event: {}, Subject: {}", eventName, subjectName);
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            log.info("BaknusDrive Create Subject Response: {} - {}", response.getStatusCode(), response.getBody());
            return response.getBody();
        } catch (Exception e) {
            log.error("Error creating subject folder in BaknusDrive: {}", e.getMessage());
            return "Error: " + e.getMessage();
        }
    }

    // 3. Guru mengupload Soal
    public String uploadSoal(String eventName, String subjectName, MultipartFile file) {
        String url = driveApiUrl + "/class/upload-soal";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.set("X-Class-API-Key", apiKey);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("event_name", eventName);
        body.add("subject_name", subjectName);
        body.add("file", file.getResource());

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        try {
            log.info("Uploading soal to BaknusDrive. Event: {}, Subject: {}", eventName, subjectName);
            ResponseEntity<String> response = restTemplate.postForEntity(url, requestEntity, String.class);
            return response.getBody();
        } catch (Exception e) {
            log.error("Error uploading soal to BaknusDrive: {}", e.getMessage());
            return "Error: " + e.getMessage();
        }
    }

    // 4. Internal upload using Resource
    public String uploadFileResource(String eventName, String subjectName,
            org.springframework.core.io.Resource resource) {
        String url = driveApiUrl + "/class/upload-soal";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.set("X-Class-API-Key", apiKey);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("event_name", eventName);
        body.add("subject_name", subjectName);
        body.add("file", resource);

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        try {
            log.info("Uploading generated file to BaknusDrive for event: {}, subject: {}", eventName, subjectName);
            ResponseEntity<String> response = restTemplate.postForEntity(url, requestEntity, String.class);
            return response.getBody();
        } catch (Exception e) {
            log.error("Error uploading file to BaknusDrive: {}", e.getMessage());
            return "Error: " + e.getMessage();
        }
    }
}
