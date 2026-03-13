package com.baknusbelajar.api.security;

import com.baknusbelajar.api.entity.Users;
import com.baknusbelajar.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String emailOrUsername) throws UsernameNotFoundException {
        Users user = userRepository.findByEmail(emailOrUsername)
                .orElseGet(() -> userRepository.findByUsername(emailOrUsername)
                        .orElseThrow(() -> new UsernameNotFoundException(
                                "User not found with email or username: " + emailOrUsername)));
        return CustomUserDetails.create(user);
    }

    public UserDetails loadUserById(Long id) {
        Users user = userRepository.findById(id).orElseThrow(
                () -> new UsernameNotFoundException("User not found with id: " + id));
        return CustomUserDetails.create(user);
    }
}
