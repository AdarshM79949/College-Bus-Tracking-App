package com.campusbus;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class CampusBusApplication {

    public static void main(String[] args) {
        SpringApplication.run(CampusBusApplication.class, args);
        System.out.println("=================================================");
        System.out.println("🚀 Campus Bus Tracker - Java Database Backend Running!");
        System.out.println("API Port: http://localhost:8080");
        System.out.println("H2 Database Console: http://localhost:8080/h2-console");
        System.out.println("JDBC URL: jdbc:h2:mem:campus_bus (User: sa, Password: <empty>)");
        System.out.println("=================================================");
    }
}
