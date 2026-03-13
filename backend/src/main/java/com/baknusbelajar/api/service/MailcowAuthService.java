package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.auth.MailcowUserDTO;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.Store;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Properties;

@Slf4j
@Service
public class MailcowAuthService {

    private final WebClient webClient;

    @Value("${mailcow.url}")
    private String mailcowUrl;

    @Value("${mailcow.api-key}")
    private String mailcowApiKey;

    public MailcowAuthService(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }

    public MailcowUserDTO authenticateAndGetTags(String email, String password) {
        if (!verifyImapCredentials(email, password)) {
            return null;
        }

        try {
            MailcowUserDTO response = webClient.get()
                    .uri(mailcowUrl + "/api/v1/get/mailbox/" + email)
                    .header("X-API-Key", mailcowApiKey)
                    .retrieve()
                    .bodyToMono(MailcowUserDTO.class)
                    .block();

            if (response != null) {
                return response;
            }
        } catch (Exception e) {
            log.error("Failed to fetch mailbox details from Mailcow API for {}: {}", email, e.getMessage());
        }

        return null;
    }

    public List<MailcowUserDTO> getAllMailboxes() {
        log.info("Requesting all mailboxes from Mailcow API...");
        try {
            // Try fetching as a Map first (common in many Mailcow versions)
            Object response = webClient.get()
                    .uri(mailcowUrl + "/api/v1/get/mailbox/all")
                    .header("X-API-Key", mailcowApiKey)
                    .retrieve()
                    .bodyToMono(Object.class)
                    .block();

            List<MailcowUserDTO> dtos = new ArrayList<>();

            if (response instanceof Map) {
                Map<String, Object> map = (Map<String, Object>) response;
                log.info("Mailcow API returned Map with {} entries", map.size());
                map.forEach((email, value) -> {
                    if (value instanceof Map) {
                        Map<String, Object> details = (Map<String, Object>) value;
                        MailcowUserDTO dto = new MailcowUserDTO();
                        dto.setUsername(email);
                        Object nameObj = details.get("name");
                        dto.setName(nameObj != null ? nameObj.toString() : null);

                        Object activeObj = details.get("active");
                        if (activeObj instanceof Number) {
                            dto.setActive(((Number) activeObj).intValue());
                        }

                        Object tagsObj = details.get("tags");
                        if (tagsObj instanceof List) {
                            dto.setTags((List<String>) tagsObj);
                        }
                        dtos.add(dto);
                    }
                });
            } else if (response instanceof List) {
                List<Object> list = (List<Object>) response;
                log.info("Mailcow API returned List with {} entries", list.size());
                for (Object item : list) {
                    if (item instanceof Map) {
                        Map<String, Object> details = (Map<String, Object>) item;
                        MailcowUserDTO dto = new MailcowUserDTO();
                        dto.setUsername((String) details.get("username"));
                        dto.setName((String) details.get("name"));
                        Object activeObj = details.get("active");
                        if (activeObj instanceof Number) {
                            dto.setActive(((Number) activeObj).intValue());
                        }
                        dto.setTags((List<String>) details.get("tags"));
                        dtos.add(dto);
                    }
                }
            } else {
                log.warn("Unknown response type from Mailcow API: {}",
                        response != null ? response.getClass().getName() : "null");
            }
            return dtos;
        } catch (Exception e) {
            log.error("CRITICAL: Failed to fetch all mailboxes from Mailcow API: {}", e.getMessage(), e);
            return List.of();
        }
    }

    private boolean verifyImapCredentials(String email, String password) {
        String imapHost = mailcowUrl.replace("http://", "").replace("https://", "").split(":")[0];

        Properties props = new Properties();
        props.put("mail.imap.host", imapHost);
        props.put("mail.imap.port", "143");
        props.put("mail.imap.starttls.enable", "true");
        props.put("mail.imap.ssl.trust", "*");

        Session session = Session.getInstance(props);
        try (Store store = session.getStore("imap")) {
            store.connect(imapHost, email, password);
            return true;
        } catch (MessagingException e) {
            log.warn("IMAP login failed for user: {}", email);
            return false;
        }
    }
}
