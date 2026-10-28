package com.campusbus.service;

import com.campusbus.entity.*;
import com.campusbus.repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final RouteRepository routeRepository;
    private final BusRepository busRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public DataSeeder(UserRepository userRepository, RouteRepository routeRepository, BusRepository busRepository) {
        this.userRepository = userRepository;
        this.routeRepository = routeRepository;
        this.busRepository = busRepository;
    }

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        if (userRepository.count() > 0 && routeRepository.count() >= 5) {
            System.out.println("[Java DB] Database already contains data. Skipping initial seeding.");
            return;
        }

        System.out.println("[Java DB] Seeding initial MGM College database with users, routes, and buses...");

        // 1. Create Users
        User admin = createUser("Admin", "admin@mgm.ac.in", "admin123", "admin");
        User student = createUser("Student", "student@mgm.ac.in", "student123", "student");

        Map<String, User> drivers = new HashMap<>();
        drivers.put("PMNA BUS MGM", createUser("PMNA BUS MGM", "pmnabus@mgm.ac.in", "driver123", "driver"));
        drivers.put("EDAPPAL BUS MGM", createUser("EDAPPAL BUS MGM", "edappalbus@mgm.ac.in", "driver123", "driver"));
        drivers.put("TIRUR BUS MGM", createUser("TIRUR BUS MGM", "tirurbus@mgm.ac.in", "driver123", "driver"));
        drivers.put("KOTTAKKAL BUS MGM", createUser("KOTTAKKAL BUS MGM", "kottakkalbus@mgm.ac.in", "driver123", "driver"));
        drivers.put("KUTTIPPURAM BUS MGM", createUser("KUTTIPPURAM BUS MGM", "kuttippurambus@mgm.ac.in", "driver123", "driver"));

        // 2. Load 5 MGM College Routes & Real Road Polylines from classpath
        ClassPathResource resource = new ClassPathResource("routes_seed.json");
        Map<String, Route> savedRoutes = new HashMap<>();

        if (resource.exists()) {
            try (InputStream is = resource.getInputStream()) {
                JsonNode root = objectMapper.readTree(is);
                for (JsonNode rNode : root) {
                    String name = rNode.get("name").asText();
                    Route route = new Route(name);

                    // Polyline
                    JsonNode polyNode = rNode.get("polyline");
                    if (polyNode != null && polyNode.isArray()) {
                        List<List<Double>> poly = objectMapper.convertValue(polyNode, new TypeReference<List<List<Double>>>() {});
                        route.setPolyline(poly);
                    }

                    // Stops
                    JsonNode stopsNode = rNode.get("stops");
                    if (stopsNode != null && stopsNode.isArray()) {
                        for (JsonNode sNode : stopsNode) {
                            String stopName = sNode.get("name").asText();
                            Double lat = sNode.get("lat").asDouble();
                            Double lng = sNode.get("lng").asDouble();
                            Integer order = sNode.get("order").asInt();
                            route.addStop(new Stop(stopName, lat, lng, order));
                        }
                    }

                    Route saved = routeRepository.save(route);
                    savedRoutes.put(name, saved);
                }
            }
        }

        // 3. Link 5 Buses to their Routes and Drivers
        linkBus("PMNA BUS MGM", "Perinthalmanna - MGM College", drivers.get("PMNA BUS MGM"), savedRoutes);
        linkBus("EDAPPAL BUS MGM", "Edappal - MGM College", drivers.get("EDAPPAL BUS MGM"), savedRoutes);
        linkBus("TIRUR BUS MGM", "Tirur - MGM College", drivers.get("TIRUR BUS MGM"), savedRoutes);
        linkBus("KOTTAKKAL BUS MGM", "Kottakkal - MGM College", drivers.get("KOTTAKKAL BUS MGM"), savedRoutes);
        linkBus("KUTTIPPURAM BUS MGM", "Kuttippuram - MGM College", drivers.get("KUTTIPPURAM BUS MGM"), savedRoutes);

        System.out.println("[Java DB] Seeding completed successfully! 5 regional routes, 5 buses, and demo accounts ready.");
    }

    private User createUser(String name, String email, String plainPassword, String role) {
        return userRepository.findByEmailIgnoreCase(email).orElseGet(() -> {
            String hash = passwordEncoder.encode(plainPassword);
            return userRepository.save(new User(name, email, hash, role));
        });
    }

    private void linkBus(String busNumber, String routeName, User driver, Map<String, Route> routes) {
        Route r = routes.get(routeName);
        if (r != null && driver != null) {
            busRepository.findByBusNumber(busNumber).orElseGet(() -> {
                return busRepository.save(new Bus(busNumber, r, driver));
            });
        }
    }
}
