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
import java.util.Map;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
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
            java.net.URL url = java.net.URI.create(urlStr).toURL();
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
            java.net.URL url = java.net.URI.create(urlStr).toURL();
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
            URL url = URI.create(urlStr).toURL();
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

        String contentType = "application/octet-stream";
        if (fileName.endsWith(".docx")) {
            contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        } else if (fileName.endsWith(".xlsx")) {
            contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        }

        os.write(("Content-Type: " + contentType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        os.write(fileBytes);
        os.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    // 5. Guru mengupload Materi (Privat ke Drive Guru)
    public String uploadMateri(String teacherEmail, String subjectName, String className, MultipartFile file) {
        try {
            return uploadMateriBytes(teacherEmail, subjectName, className, file.getBytes(), file.getOriginalFilename());
        } catch (IOException e) {
            log.error("Error reading file bytes: {}", e.getMessage());
            return "Error: " + e.getMessage();
        }
    }

    public String uploadMateriBytes(String teacherEmail, String subjectName, String className, byte[] fileBytes,
            String fileName) {
        String url = driveApiUrl + "/class/upload-materi";
        log.info(">>> BaknusDrive: Uploading data as file '{}' for teacher '{}' subject '{}' class '{}'",
                fileName, teacherEmail, subjectName, className);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.set("X-Class-API-Key", apiKey);

        // Simple custom implementation of Resource for byte arrays to work with
        // LinkedMultiValueMap
        org.springframework.core.io.Resource resource = new org.springframework.core.io.ByteArrayResource(fileBytes) {
            @Override
            public String getFilename() {
                return fileName;
            }
        };

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("teacher_email", teacherEmail);
        body.add("subject_name", subjectName);
        body.add("class_name", className);
        body.add("file", resource);

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, requestEntity, String.class);
            log.info("BaknusDrive Upload Response: {} - {}", response.getStatusCode(), response.getBody());
            return response.getBody();
        } catch (Exception e) {
            log.error("Error uploading to BaknusDrive: {}", e.getMessage());
            return "Error: " + e.getMessage();
        }
    }

    public String uploadTugas(String studentEmail, String teacherEmail, String subjectName, MultipartFile file) {
        String url = driveApiUrl + "/class/upload-tugas";
        log.info(">>> BaknusDrive: Uploading assignment for student '{}' shared with teacher '{}' subject '{}'",
                studentEmail, teacherEmail, subjectName);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.set("X-Class-API-Key", apiKey);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("student_email", studentEmail);
        body.add("teacher_email", teacherEmail);
        body.add("subject_name", subjectName);
        body.add("file", file.getResource());

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, requestEntity, String.class);
            log.info("BaknusDrive Task Upload Response: {} - {}", response.getStatusCode(), response.getBody());
            return response.getBody();
        } catch (Exception e) {
            log.error("Error uploading task to BaknusDrive: {}", e.getMessage());
            return "Error: " + e.getMessage();
        }
    }

    // 4. Get Collabora Viewer URL for Materials (Integration)
    public String getCollaboraViewerUrl(String fileId) {
        String url = driveApiUrl + "/class/doc/open/" + fileId;
        log.info(">>> BaknusDrive: Requesting Collabora viewer URL for fileId: {}", fileId);

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Class-API-Key", apiKey);
        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(url, HttpMethod.GET, entity,
                    (Class<Map<String, Object>>) (Class<?>) Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return (String) response.getBody().get("url");
            }
        } catch (Exception e) {
            log.error("Error getting Collabora viewer URL from BaknusDrive: {}", e.getMessage());
        }
        return null; // Fallback handled in MateriService
    }

    public ResponseEntity<byte[]> downloadFile(Long driveFileId) {
        return downloadFileWithFilename(driveFileId, "file_" + driveFileId, false);
    }

    public ResponseEntity<byte[]> downloadFileWithFilename(Long driveFileId, String actualFileName,
            boolean isDownload) {
        // Construct WOPI download URL (internal trust) using server base URL
        String baseUrl = driveApiUrl.replace("/api", "");
        String internalToken = "BAKNUS_SECRET_INTERNAL_KEY_999";
        String url = baseUrl + "/wopi/files/" + driveFileId + "/contents?access_token=" + internalToken;

        try {
            ResponseEntity<byte[]> response = restTemplate.getForEntity(url, byte[].class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                // Try to preserve Content-Type if present, otherwise detect from filename
                MediaType contentType = response.getHeaders().getContentType();
                if (contentType == null || contentType.equals(MediaType.APPLICATION_OCTET_STREAM)) {
                    int lastDot = actualFileName.lastIndexOf(".");
                    String extension = lastDot != -1 ? actualFileName.substring(lastDot + 1).toLowerCase() : "";
                    switch (extension) {
                        case "pdf":
                            contentType = MediaType.APPLICATION_PDF;
                            break;
                        case "jpg":
                        case "jpeg":
                            contentType = MediaType.IMAGE_JPEG;
                            break;
                        case "png":
                            contentType = MediaType.IMAGE_PNG;
                            break;
                        case "gif":
                            contentType = MediaType.IMAGE_GIF;
                            break;
                        case "webp":
                            contentType = MediaType.valueOf("image/webp");
                            break;
                        case "docx":
                            contentType = MediaType
                                    .valueOf("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
                            break;
                        case "pptx":
                            contentType = MediaType.valueOf(
                                    "application/vnd.openxmlformats-officedocument.presentationml.presentation");
                            break;
                        case "xlsx":
                            contentType = MediaType
                                    .valueOf("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                            break;
                        default:
                            contentType = MediaType.APPLICATION_OCTET_STREAM;
                    }
                }

                String disposition = isDownload ? "attachment" : "inline";
                return ResponseEntity.ok()
                        .contentType(contentType)
                        .header(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"" + actualFileName + "\"")
                        .body(response.getBody());
            }
            return response;
        } catch (Exception e) {
            log.error("Error proxying download from BaknusDrive for file ID {}: {}", driveFileId, e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
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
