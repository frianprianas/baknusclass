package com.baknusbelajar.api.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

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
        String urlStr = driveApiUrl + "/class/create-event";
        log.info(">>> BaknusDrive: Calling URL: {}", urlStr);
        log.info(">>> BaknusDrive: Creating event folder: {}", eventName);
        try {
            java.net.URL url = new java.net.URL(urlStr);
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
            conn.setInstanceFollowRedirects(false); // We want to see 301/302 location
            conn.setDoOutput(true);
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("X-Class-API-Key", apiKey);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);

            String body = "{\"event_name\":\"" + eventName.replace("\"", "\\\"") + "\"}";
            try (java.io.OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                os.flush();
            }

            int responseCode = conn.getResponseCode();
            String location = conn.getHeaderField("Location");

            java.io.InputStream responseStream = responseCode >= 200 && responseCode < 300
                    ? conn.getInputStream()
                    : conn.getErrorStream();
            String responseBody = responseStream != null
                    ? new String(responseStream.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8)
                    : "(no body)";

            log.info("BaknusDrive Create Event Response: {} - {}", responseCode, responseBody);
            if (location != null)
                log.info(">>> BaknusDrive Redirect Location: {}", location);

            System.out.println(">>> BaknusDriveService Response (Create Event): " + responseCode + " - " + responseBody
                    + (location != null ? " Redirect: " + location : ""));
            return responseBody;
        } catch (Exception e) {
            log.error("Error creating event folder: {}", e.getMessage(), e);
            return "Error: " + e.getMessage();
        }
    }

    // 2. Subject folder (mata pelajaran) inside event folder
    public String createSubjectFolder(String eventName, String subjectName) {
        String urlStr = driveApiUrl + "/class/create-subject-folder";
        log.info(">>> BaknusDrive: Creating subject folder: {} inside event: {}", subjectName, eventName);
        try {
            java.net.URL url = new java.net.URL(urlStr);
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setDoOutput(true);
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("X-Class-API-Key", apiKey);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);

            String body = "{\"event_name\":\"" + eventName.replace("\"", "\\\"") + "\","
                    + "\"subject_name\":\"" + subjectName.replace("\"", "\\\"") + "\"}";
            try (java.io.OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                os.flush();
            }

            int responseCode = conn.getResponseCode();
            java.io.InputStream responseStream = responseCode >= 200 && responseCode < 300
                    ? conn.getInputStream()
                    : conn.getErrorStream();
            String responseBody = responseStream != null
                    ? new String(responseStream.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8)
                    : "(no body)";

            log.info("BaknusDrive Create Subject Folder Response: {} - {}", responseCode, responseBody);
            System.out.println(
                    ">>> BaknusDriveService Response (Create Subject): " + responseCode + " - " + responseBody);
            return responseBody;
        } catch (Exception e) {
            log.error("Error creating subject folder: {}", e.getMessage(), e);
            return "Error: " + e.getMessage();
        }
    }

    // 3. Guru mengupload Soal (dari form)
    public String uploadSoal(String eventName, String subjectName, MultipartFile file) {
        ensureFoldersExist(eventName, subjectName);
        try {
            return multipartUpload(driveApiUrl + "/class/upload-soal",
                    eventName, subjectName, file.getBytes(), file.getOriginalFilename());
        } catch (IOException e) {
            log.error("Error reading multipart file: {}", e.getMessage());
            return "Error: " + e.getMessage();
        }
    }

    // 4. Internal upload using Spring Resource (generated docx)
    public String uploadFileResource(String eventName, String subjectName, Resource resource) {
        ensureFoldersExist(eventName, subjectName);
        log.info(">>> BaknusDrive: Uploading generated file '{}' event={} subject={}",
                resource.getFilename(), eventName, subjectName);
        try (InputStream is = resource.getInputStream()) {
            byte[] bytes = is.readAllBytes();
            return multipartUpload(driveApiUrl + "/class/upload-soal",
                    eventName, subjectName, bytes, resource.getFilename());
        } catch (IOException e) {
            log.error("Error reading resource: {}", e.getMessage());
            return "Error: " + e.getMessage();
        }
    }

    public String uploadFileBytes(String eventName, String subjectName, byte[] bytes, String fileName) {
        ensureFoldersExist(eventName, subjectName);
        log.info(">>> BaknusDrive: Uploading byte array file '{}' event={} subject={}",
                fileName, eventName, subjectName);
        return multipartUpload(driveApiUrl + "/class/upload-soal",
                eventName, subjectName, bytes, fileName);
    }

    private String multipartUpload(String urlStr, String eventName, String subjectName,
            byte[] fileBytes, String fileName) {
        String boundary = "----FormBoundary" + UUID.randomUUID().toString().replace("-", "");
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setDoOutput(true);
            conn.setRequestMethod("POST");
            conn.setRequestProperty("X-Class-API-Key", apiKey);
            conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);

            try (OutputStream os = conn.getOutputStream()) {
                // event_name field
                writeField(os, boundary, "event_name", eventName);
                // subject_name field
                writeField(os, boundary, "subject_name", subjectName);
                // file field
                writeFilePart(os, boundary, "file", fileName != null ? fileName : "kartu_soal.docx", fileBytes);
                // closing boundary
                os.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
                os.flush();
            }

            int responseCode = conn.getResponseCode();
            log.info("BaknusDrive upload response code: {}", responseCode);

            InputStream responseStream = responseCode >= 200 && responseCode < 300
                    ? conn.getInputStream()
                    : conn.getErrorStream();
            String responseBody = responseStream != null
                    ? new String(responseStream.readAllBytes(), StandardCharsets.UTF_8)
                    : "(no body)";

            log.info("BaknusDrive upload response body: {}", responseBody);
            System.out.println(">>> BaknusDrive upload result: " + responseCode + " - " + responseBody);
            return responseBody;
        } catch (Exception e) {
            log.error("MultipartUpload error: {}", e.getMessage(), e);
            return "Error: " + e.getMessage();
        }
    }

    private void writeField(OutputStream os, String boundary, String name, String value) throws IOException {
        os.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        os.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        os.write((value + "\r\n").getBytes(StandardCharsets.UTF_8));
    }

    private void writeFilePart(OutputStream os, String boundary, String fieldName,
            String fileName, byte[] fileBytes) throws IOException {
        os.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        os.write(("Content-Disposition: form-data; name=\"" + fieldName
                + "\"; filename=\"" + fileName + "\"\r\n").getBytes(StandardCharsets.UTF_8));
        os.write("Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n"
                .getBytes(StandardCharsets.UTF_8));
        os.write(fileBytes);
        os.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private void ensureFoldersExist(String eventName, String subjectName) {
        try {
            log.info(">>> BaknusDrive: Ensuring event folder exists: {}", eventName);
            createEventFolder(eventName);
        } catch (Exception e) {
            log.warn("ensureFoldersExist (event): failed (may already exist): {}", e.getMessage());
        }
        try {
            if (subjectName != null && !subjectName.isBlank()) {
                log.info(">>> BaknusDrive: Ensuring subject folder exists: {} in event: {}", subjectName, eventName);
                createSubjectFolder(eventName, subjectName);
            }
        } catch (Exception e) {
            log.warn("ensureFoldersExist (subject): failed (may already exist): {}", e.getMessage());
        }
    }
}
