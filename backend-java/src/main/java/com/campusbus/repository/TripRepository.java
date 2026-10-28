package com.campusbus.repository;

import com.campusbus.entity.Trip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TripRepository extends JpaRepository<Trip, Long> {
    List<Trip> findByBusIdOrderByStartedAtDesc(Long busId);
}
