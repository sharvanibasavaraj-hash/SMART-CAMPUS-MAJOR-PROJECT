
CREATE DATABASE IF NOT EXISTS vkit_smart_campus;

USE vkit_smart_campus;

CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS buildings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    building_id INT,
    department_id INT,
    room_code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    type ENUM(
        'CLASSROOM',
        'LABORATORY',
        'SEMINAR_HALL',
        'AUDITORIUM',
        'MEETING_ROOM'
    ) NOT NULL,
    capacity INT NOT NULL,
    status ENUM('AVAILABLE', 'MAINTENANCE', 'INACTIVE')
        DEFAULT 'AVAILABLE',
    FOREIGN KEY (building_id) REFERENCES buildings(id),
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS equipment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT,
    room_id INT,
    name VARCHAR(100) NOT NULL,
    asset_code VARCHAR(50) NOT NULL UNIQUE,
    total_quantity INT NOT NULL,
    available_quantity INT NOT NULL,
    condition_status ENUM(
        'GOOD',
        'DAMAGED',
        'UNDER_MAINTENANCE'
    ) DEFAULT 'GOOD',
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requester_name VARCHAR(100) NOT NULL,
    requester_email VARCHAR(150) NOT NULL,
    department_id INT,
    room_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    purpose TEXT,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    attendees INT NOT NULL,
    status ENUM(
        'PENDING',
        'APPROVED',
        'REJECTED',
        'CANCELLED'
    ) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_room_status ON rooms(status);
CREATE INDEX idx_booking_date ON bookings(booking_date);
CREATE INDEX idx_booking_room ON bookings(room_id);
CREATE INDEX idx_equipment_department ON equipment(department_id);

INSERT IGNORE INTO buildings (name)
VALUES ('Main Academic Block');
