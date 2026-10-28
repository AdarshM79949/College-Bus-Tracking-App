package com.campusbus.controller;

import com.campusbus.entity.User;
import com.campusbus.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public AuthController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String identifier = body.get("email");
        String password = body.get("password");

        if (identifier == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "email and password required"));
        }

        // Allow login by email or driver username
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(identifier.trim());
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByNameIgnoreCase(identifier.trim());
        }

        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid credentials"));
        }

        User user = userOpt.get();
        if (!passwordEncoder.matches(password, user.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid credentials"));
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("token", "java-demo-token-" + user.getId());
        resp.put("user", Map.of(
                "id", user.getId(),
                "name", user.getName(),
                "email", user.getEmail(),
                "role", user.getRole()
        ));
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        String email = body.get("email");
        String password = body.get("password");

        if (name == null || email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "name, email, password required"));
        }

        if (userRepository.findByEmailIgnoreCase(email.trim()).isPresent()) {
            return ResponseEntity.status(409).body(Map.of("message", "Email already registered"));
        }

        // Public registration is always student role
        User user = new User(name.trim(), email.trim().toLowerCase(), passwordEncoder.encode(password), "student");
        User saved = userRepository.save(user);

        Map<String, Object> resp = new HashMap<>();
        resp.put("token", "java-demo-token-" + saved.getId());
        resp.put("user", Map.of(
                "id", saved.getId(),
                "name", saved.getName(),
                "email", saved.getEmail(),
                "role", saved.getRole()
        ));
        return ResponseEntity.status(201).body(resp);
    }
}
