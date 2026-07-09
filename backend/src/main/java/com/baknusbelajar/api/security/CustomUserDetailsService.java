package com.baknusbelajar.api.security;

import com.baknusbelajar.api.entity.Users;
import com.baknusbelajar.api.repository.UserRepository;
import com.baknusbelajar.api.repository.GuruRepository;
import com.baknusbelajar.api.entity.Guru;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final GuruRepository guruRepository;

    @Override
    public UserDetails loadUserByUsername(String emailOrUsername) throws UsernameNotFoundException {
        Users user = userRepository.findByEmail(emailOrUsername)
                .orElseGet(() -> userRepository.findByUsername(emailOrUsername)
                        .orElseThrow(() -> new UsernameNotFoundException(
                                "User not found with email or username: " + emailOrUsername)));
        
        boolean isCoAdmin = false;
        if ("GURU".equalsIgnoreCase(user.getRole())) {
            isCoAdmin = guruRepository.findByUserId(user.getId())
                    .map(Guru::getIsCoAdmin)
                    .orElse(false);
        }
        
        return CustomUserDetails.create(user, isCoAdmin);
    }

    public UserDetails loadUserById(Long id) {
        Users user = userRepository.findById(id).orElseThrow(
                () -> new UsernameNotFoundException("User not found with id: " + id));
        
        boolean isCoAdmin = false;
        if ("GURU".equalsIgnoreCase(user.getRole())) {
            isCoAdmin = guruRepository.findByUserId(user.getId())
                    .map(Guru::getIsCoAdmin)
                    .orElse(false);
        }
        
        return CustomUserDetails.create(user, isCoAdmin);
    }
}
