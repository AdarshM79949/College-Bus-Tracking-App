package com.campusbus.entity;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "routes")
public class Route {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @OneToMany(mappedBy = "route", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("order ASC")
    @JsonManagedReference
    private List<Stop> stops = new ArrayList<>();

    @Lob
    @Column(columnDefinition = "CLOB")
    private String polylineJson = "[]";

    public Route() {}

    public Route(String name) {
        this.name = name;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public List<Stop> getStops() { return stops; }
    public void setStops(List<Stop> stops) {
        this.stops = stops;
        if (stops != null) {
            for (Stop s : stops) {
                s.setRoute(this);
            }
        }
    }

    public void addStop(Stop stop) {
        stops.add(stop);
        stop.setRoute(this);
    }

    public String getPolylineJson() { return polylineJson; }
    public void setPolylineJson(String polylineJson) { this.polylineJson = polylineJson; }

    @Transient
    public List<List<Double>> getPolyline() {
        if (polylineJson == null || polylineJson.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return MAPPER.readValue(polylineJson, new TypeReference<List<List<Double>>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    @Transient
    public void setPolyline(List<List<Double>> polyline) {
        try {
            this.polylineJson = MAPPER.writeValueAsString(polyline);
        } catch (Exception e) {
            this.polylineJson = "[]";
        }
    }
}
