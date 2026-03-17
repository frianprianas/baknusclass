package com.baknusbelajar.api.controller;

import com.baknusbelajar.api.dto.forum.ForumWSMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class ForumWSController {

    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/forum/typing")
    public void handleTyping(@Payload ForumWSMessage message) {
        // Broadcast to everyone subscribed to that topic
        messagingTemplate.convertAndSend("/topic/forum/" + message.getTopikId(), message);
    }
}
