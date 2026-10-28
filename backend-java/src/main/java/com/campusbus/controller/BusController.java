package com.campusbus.controller;

import com.campusbus.entity.Bus;
import com.campusbus.repository.BusRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/buses")
@CrossOrigin(origins = "*")
public class BusController {

    private final BusRepository busRepository;

    public BusController(BusRepository busRepository) {
        this.busRepository = busRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAllBuses(
            @RequestParam(required = false) Long routeId,
            @RequestParam(required = false) Long driverId) {

        List<Bus> buses;
        if (routeId != null) {
            buses = busRepository.findByRouteId(routeId);
        } else if (driverId != null) {
            buses = busRepository.findByDriverId(driverId);
        } else {
            buses = busRepository.findAll();
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("buses", buses);
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getBusById(@PathVariable Long id) {
        return busRepository.findById(id)
                .map(b -> {
                    Map<String, Object> resp = new HashMap<>();
                    resp.put("bus", b);
                    return ResponseEntity.ok(resp);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/location")
    public ResponseEntity<?> updateLocation(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        return busRepository.findById(id)
                .map(bus -> {
                    if (body.containsKey("lat")) bus.setCurrentLat(((Number) body.get("lat")).doubleValue());
                    if (body.containsKey("lng")) bus.setCurrentLng(((Number) body.get("lng")).doubleValue());
                    if (body.containsKey("speed")) bus.setCurrentSpeed(((Number) body.get("speed")).doubleValue());
                    if (body.containsKey("status")) bus.setStatus(body.get("status").toString());
                    bus.setUpdatedAt(LocalDateTime.now());
                    Bus saved = busRepository.save(bus);
                    Map<String, Object> resp = new HashMap<>();
                    resp.put("bus", saved);
                    return ResponseEntity.ok(resp);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
