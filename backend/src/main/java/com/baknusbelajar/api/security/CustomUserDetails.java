package com.baknusbelajar.api.security;

import com.baknusbelajar.api.entity.Users;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;

@Getter
@AllArgsConstructor
public class CustomUserDetails implements UserDetails {
    private Long id;
    private String email;
    private String username;
    private String password;
    private Collection<? extends GrantedAuthority> authorities;

    public static CustomUserDetails create(Users user) {
        GrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + user.getRole().toUpperCase());
        return new CustomUserDetails(
                user.getId(),
                user.getEmail(),
                user.getUsername(),
                user.getPasswordHash(),
                Collections.singletonList(authority));
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
