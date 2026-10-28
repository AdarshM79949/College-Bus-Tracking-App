# Campus Bus Tracker - Java Database Backend (Spring Boot + JPA)

A complete, production-grade Java database backend for the **Campus Bus Tracking System** (MGM College of Engineering and Pharmaceutical Sciences, Valanchery).

---

## 🔌 How Java Connects to the Database

This project provides **two ways** to connect to the database in Java:

### 1. Spring Data JPA & Hibernate (Default)
Spring Boot automatically creates and manages the database connection pool using HikariCP and Hibernate:
- Configured in: `src/main/resources/application.properties`
- Maps relational tables to Java objects (`@Entity`) with automatic repository queries (`JpaRepository`).
- Automatically handles transactions, connection pooling, and schema generation.

### 2. Pure Java JDBC Connector (`DatabaseConnection.java`)
If you want to connect directly using standard Java JDBC (`DriverManager`, `PreparedStatement`, `ResultSet`):
- File location: `src/main/java/com/campusbus/jdbc/DatabaseConnection.java`
- Example usage in Java:
```java
// Connect via JDBC
Connection conn = DriverManager.getConnection("jdbc:h2:mem:campus_bus", "sa", "");

// Run SQL Query
PreparedStatement stmt = conn.prepareStatement("SELECT * FROM routes");
ResultSet rs = stmt.executeQuery();
while (rs.next()) {
    System.out.println("Route: " + rs.getString("name"));
}
```

---

## 🛠️ Tech Stack & Architecture

- **Java Version**: Java 17+ (JDK 17 / JDK 21 LTS)
- **Framework**: Spring Boot 3.2.5
- **ORM / Persistence**: Spring Data JPA (Hibernate)
- **Database Engine**:
  - **Embedded H2 Database** (Default: in-memory / zero configuration needed, runs immediately out of the box)
  - **MySQL Connector J** (Ready to toggle on in `application.properties`)
- **Security / Hashing**: BCrypt Password Encoder
- **Build Tool**: Apache Maven

---

## 📂 Project Structure

```
backend-java/
├── pom.xml                                  # Maven dependencies & build configuration
├── src/main/resources/
│   ├── application.properties               # Database connection & port settings
│   ├── schema.sql                           # Pure SQL DDL (Table definitions)
│   └── routes_seed.json                     # MGM College 5 routes with road polylines
└── src/main/java/com/campusbus/
    ├── CampusBusApplication.java            # Main Spring Boot Entry Point
    ├── jdbc/
    │   └── DatabaseConnection.java          # Pure Java JDBC connection utility & test runner
    ├── entity/
    │   ├── User.java                        # Users (Admin, Drivers, Students)
    │   ├── Route.java                       # 5 MGM College bus routes + road polylines
    │   ├── Stop.java                        # Individual route stops (lat, lng, order)
    │   ├── Bus.java                         # Buses mapped to route & driver
    │   └── Trip.java                        # Active & historical trips
    ├── repository/
    │   ├── UserRepository.java
    │   ├── RouteRepository.java
    │   ├── StopRepository.java
    │   ├── BusRepository.java
    │   └── TripRepository.java
    ├── service/
    │   └── DataSeeder.java                  # Automatic database seeder on startup
    └── controller/
        ├── AuthController.java              # /api/auth/login, /api/auth/register
        ├── RouteController.java             # /api/routes
        └── BusController.java               # /api/buses
```

---

## 🚀 How to Run the Java Backend

### Method 1: Running with Maven
```bash
cd backend-java
mvn spring-boot:run
```

### Method 2: Running the Prebuilt JAR
```bash
cd backend-java
java -jar target/campus-bus-tracker-1.0.0.jar
```

---

## 🗄️ Database Access & H2 Web Console (Browser GUI)

When the application runs, an interactive H2 web console is available:

- **URL**: `http://localhost:8080/h2-console`
- **JDBC URL**: `jdbc:h2:mem:campus_bus`
- **User Name**: `sa`
- **Password**: *(leave blank)*

Click **Connect** to inspect all tables (`USERS`, `ROUTES`, `STOPS`, `BUSES`, `TRIPS`) directly in your browser.

---

## 🌐 Connecting the React Frontend to Java

By default, the React frontend connects to `http://localhost:4000` (Node.js). To point the frontend to the Java Spring Boot backend (`http://localhost:8080`):

In `frontend/.env` (or `frontend/src/config.js`):
```env
VITE_API_BASE=http://localhost:8080
```

---

## 🐬 Switching to MySQL

To use a persistent MySQL database instead of embedded H2, open `src/main/resources/application.properties` and uncomment the MySQL section:

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/campus_bus?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true
spring.datasource.username=root
spring.datasource.password=your_mysql_password
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
spring.jpa.database-platform=org.hibernate.dialect.MySQLDialect
```

---

## 🔑 Pre-Seeded Accounts

| Role | Username / Email | Password | Assigned Bus / Route |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@mgm.ac.in` | `admin123` | Full access to fleet monitor |
| **Student** | `student@mgm.ac.in` | `student123` | View routes, schedules & live ETAs |
| **Driver 1** | `PMNA BUS MGM` (`pmnabus@mgm.ac.in`) | `driver123` | Perinthalmanna - MGM College |
| **Driver 2** | `EDAPPAL BUS MGM` (`edappalbus@mgm.ac.in`) | `driver123` | Edappal - MGM College |
| **Driver 3** | `TIRUR BUS MGM` (`tirurbus@mgm.ac.in`) | `driver123` | Tirur - MGM College |
| **Driver 4** | `KOTTAKKAL BUS MGM` (`kottakkalbus@mgm.ac.in`) | `driver123` | Kottakkal - MGM College |
| **Driver 5** | `KUTTIPPURAM BUS MGM` (`kuttippurambus@mgm.ac.in`) | `driver123` | Kuttippuram - MGM College |

---

## 📡 REST API Endpoints

- `POST /api/auth/login` - Authenticate using email or driver username
- `POST /api/auth/register` - Student registration
- `GET /api/routes` - Get all 5 MGM College routes with stops and polylines
- `GET /api/routes/{id}` - Get specific route details
- `GET /api/buses` - List all registered buses (supports `?routeId=` & `?driverId=`)
- `PUT /api/buses/{id}/location` - Update real-time GPS location and speed
