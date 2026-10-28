package com.campusbus.jdbc;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Standard Java JDBC Database Connection Utility.
 * Demonstrates direct JDBC connectivity using DriverManager, PreparedStatement, and ResultSet.
 */
public class DatabaseConnection {

    // Default: Embedded H2 In-Memory Database (matches Spring Boot)
    private static final String H2_URL = "jdbc:h2:mem:campus_bus;DB_CLOSE_DELAY=-1";
    private static final String H2_USER = "sa";
    private static final String H2_PASSWORD = "";

    // Optional: MySQL Database Configuration
    private static final String MYSQL_URL = "jdbc:mysql://localhost:3306/campus_bus?createDatabaseIfNotExist=true&useSSL=false";
    private static final String MYSQL_USER = "root";
    private static final String MYSQL_PASSWORD = "password";

    /**
     * Get a direct JDBC Connection to the H2 database.
     */
    public static Connection getH2Connection() throws SQLException {
        return DriverManager.getConnection(H2_URL, H2_USER, H2_PASSWORD);
    }

    /**
     * Get a direct JDBC Connection to a MySQL database.
     */
    public static Connection getMySQLConnection() throws SQLException {
        return DriverManager.getConnection(MYSQL_URL, MYSQL_USER, MYSQL_PASSWORD);
    }

    /**
     * Test execution: Connects and prints all active routes and buses from the database.
     */
    public static void main(String[] args) {
        System.out.println("Connecting to Database using Java JDBC...");

        try (Connection conn = getH2Connection()) {
            System.out.println("✅ JDBC Connection Successful! Database: " + conn.getMetaData().getDatabaseProductName());

            // 1. Query all routes
            String routeQuery = "SELECT id, name FROM routes";
            try (PreparedStatement stmt = conn.prepareStatement(routeQuery);
                 ResultSet rs = stmt.executeQuery()) {
                System.out.println("\n--- MGM College Bus Routes ---");
                while (rs.next()) {
                    long id = rs.getLong("id");
                    String name = rs.getString("name");
                    System.out.printf("Route #%d: %s%n", id, name);
                }
            }

            // 2. Query all buses
            String busQuery = "SELECT id, bus_number, status FROM buses";
            try (PreparedStatement stmt = conn.prepareStatement(busQuery);
                 ResultSet rs = stmt.executeQuery()) {
                System.out.println("\n--- Campus Fleet Buses ---");
                while (rs.next()) {
                    long id = rs.getLong("id");
                    String busNumber = rs.getString("bus_number");
                    String status = rs.getString("status");
                    System.out.printf("Bus #%d: %s [Status: %s]%n", id, busNumber, status);
                }
            }

        } catch (SQLException e) {
            System.err.println("❌ JDBC Connection failed: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
