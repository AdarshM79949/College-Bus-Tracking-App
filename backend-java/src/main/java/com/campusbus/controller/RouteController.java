package com.campusbus.controller;

import com.campusbus.entity.Route;
import com.campusbus.repository.RouteRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/routes")
@CrossOrigin(origins = "*")
public class RouteController {

    private final RouteRepository routeRepository;

    public RouteController(RouteRepository routeRepository) {
        this.routeRepository = routeRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAllRoutes() {
        List<Route> routes = routeRepository.findAll();
        Map<String, Object> response = new HashMap<>();
        response.put("routes", routes);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getRouteById(@PathVariable Long id) {
        return routeRepository.findById(id)
                .map(r -> {
                    Map<String, Object> resp = new HashMap<>();
                    resp.put("route", r);
                    return ResponseEntity.ok(resp);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createRoute(@RequestBody Route route) {
        Route saved = routeRepository.save(route);
        Map<String, Object> resp = new HashMap<>();
        resp.put("route", saved);
        return ResponseEntity.status(201).body(resp);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteRoute(@PathVariable Long id) {
        if (!routeRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        routeRepository.deleteById(id);
        Map<String, Object> resp = new HashMap<>();
        resp.put("ok", true);
        return ResponseEntity.ok(resp);
    }
}
