
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const pool = require("./database");
const path = require("path");

const app = express();

app.use(cors({
    origin: "http://localhost:5000",
    credentials: true
}));

app.use(express.json());
app.use(express.static(__dirname));

app.use(session({
    name: "vkit_management_session",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "strict",
        secure: false,
        maxAge: 2 * 60 * 60 * 1000
    }
}));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Management authentication
function requireManagement(req, res, next) {
    if (!req.session || !req.session.isManagement) {
        return res.status(401).json({
            message: "Management login required."
        });
    }

    next();
}

app.get("/api/management/session", (req, res) => {
    res.json({
        loggedIn: Boolean(req.session?.isManagement)
    });
});

app.post("/api/management/login", (req, res, next) => {
    const { managementId, password } = req.body;

    if (
        !managementId ||
        !password ||
        managementId !== process.env.MANAGEMENT_ID ||
        password !== process.env.MANAGEMENT_PASSWORD
    ) {
        return res.status(401).json({
            message: "Invalid management ID or password."
        });
    }

    req.session.regenerate(error => {
        if (error) return next(error);

        req.session.isManagement = true;

        req.session.save(error => {
            if (error) return next(error);

            res.json({
                message: "Management login successful.",
                loggedIn: true
            });
        });
    });
});

app.post("/api/management/logout", requireManagement, (req, res) => {
    req.session.destroy(error => {
        if (error) {
            return res.status(500).json({
                message: "Could not log out."
            });
        }

        res.clearCookie("vkit_management_session");
        res.json({ message: "Logged out successfully." });
    });
});

// Dashboard statistics
app.get("/api/dashboard", async (req, res) => {
    try {
        const [[rooms]] = await pool.query(`
            SELECT
                COUNT(*) AS total,
                COALESCE(SUM(status = 'AVAILABLE'), 0) AS available,
                COALESCE(SUM(status = 'MAINTENANCE'), 0) AS maintenance
            FROM rooms
        `);

        const [[equipment]] = await pool.query(`
            SELECT
                COUNT(*) AS types,
                COALESCE(SUM(total_quantity), 0) AS total,
                COALESCE(SUM(available_quantity), 0) AS available
            FROM equipment
        `);

        const [[bookings]] = await pool.query(`
            SELECT
                COUNT(*) AS total,
                COALESCE(SUM(status = 'PENDING'), 0) AS pending,
                COALESCE(SUM(status = 'APPROVED'), 0) AS approved
            FROM bookings
        `);

        const [[departments]] = await pool.query(
            "SELECT COUNT(*) AS total FROM departments"
        );

        res.json({ rooms, equipment, bookings, departments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not load dashboard." });
    }
});

// Departments
app.get("/api/departments", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT d.*, COUNT(r.id) AS room_count
            FROM departments d
            LEFT JOIN rooms r ON r.department_id = d.id
            GROUP BY d.id
            ORDER BY d.name
        `);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not load departments." });
    }
});

app.post("/api/departments", async (req, res) => {
    try {
        const { code, name } = req.body;

        if (!code?.trim() || !name?.trim()) {
            return res.status(400).json({
                message: "Department code and name are required."
            });
        }

        const [result] = await pool.query(
            "INSERT INTO departments (code, name) VALUES (?, ?)",
            [code.trim().toUpperCase(), name.trim()]
        );

        await pool.query(`
            INSERT INTO audit_logs (action, entity_type, entity_id, details)
            VALUES (?, ?, ?, ?)
        `, [
            "DEPARTMENT_CREATED",
            "DEPARTMENT",
            result.insertId,
            JSON.stringify({ code, name })
        ]);

        res.status(201).json({
            message: "Department added successfully.",
            id: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({
            message: error.code === "ER_DUP_ENTRY"
                ? "That department code already exists."
                : "Could not add department."
        });
    }
});

// Buildings
app.get("/api/buildings", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM buildings ORDER BY name"
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Could not load buildings." });
    }
});

app.post("/api/buildings", async (req, res) => {
    try {
        const { name } = req.body;

        if (!name?.trim()) {
            return res.status(400).json({
                message: "Building name is required."
            });
        }

        const [result] = await pool.query(
            "INSERT INTO buildings (name) VALUES (?)",
            [name.trim()]
        );

        res.status(201).json({
            message: "Building added.",
            id: result.insertId
        });
    } catch (error) {
        res.status(400).json({
            message: "Could not add building. Check if it already exists."
        });
    }
});

// Rooms
app.get("/api/rooms", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT r.*, b.name AS building_name,
                   d.name AS department_name
            FROM rooms r
            JOIN buildings b ON b.id = r.building_id
            LEFT JOIN departments d ON d.id = r.department_id
            ORDER BY r.room_code
        `);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not load rooms." });
    }
});

app.post("/api/rooms", async (req, res) => {
    try {
        const {
            building_id, department_id, room_code,
            name, type, capacity
        } = req.body;

        const allowedTypes = [
            "CLASSROOM", "LABORATORY", "SEMINAR_HALL",
            "AUDITORIUM", "MEETING_ROOM"
        ];

        if (
            !building_id || !room_code?.trim() || !name?.trim() ||
            !allowedTypes.includes(type) ||
            !Number.isInteger(Number(capacity)) || Number(capacity) <= 0
        ) {
            return res.status(400).json({
                message: "Enter valid room details and a positive capacity."
            });
        }

        const [result] = await pool.query(`
            INSERT INTO rooms
            (building_id, department_id, room_code, name, type, capacity)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            building_id,
            department_id || null,
            room_code.trim().toUpperCase(),
            name.trim(),
            type,
            Number(capacity)
        ]);

        res.status(201).json({
            message: "Room added successfully.",
            id: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({
            message: error.code === "ER_DUP_ENTRY"
                ? "That room code already exists."
                : "Could not add room. Check the selected building and department."
        });
    }
});

// Room status
app.patch("/api/rooms/:id/status", async (req, res) => {
    try {
        const { status } = req.body;
        const allowed = ["AVAILABLE", "MAINTENANCE", "INACTIVE"];

        if (!allowed.includes(status)) {
            return res.status(400).json({ message: "Invalid room status." });
        }

        const [result] = await pool.query(
            "UPDATE rooms SET status = ? WHERE id = ?",
            [status, req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ message: "Room not found." });
        }

        res.json({ message: "Room status updated." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not update room." });
    }
});

// Equipment
app.get("/api/equipment", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT e.*, d.name AS department_name, r.room_code
            FROM equipment e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN rooms r ON r.id = e.room_id
            ORDER BY e.name
        `);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not load equipment." });
    }
});

app.post("/api/equipment", async (req, res) => {
    try {
        const {
            department_id, room_id, name,
            asset_code, total_quantity
        } = req.body;

        const quantity = Number(total_quantity);

        if (
            !name?.trim() || !asset_code?.trim() ||
            !Number.isInteger(quantity) || quantity <= 0
        ) {
            return res.status(400).json({
                message: "Enter a valid equipment name, asset code and quantity."
            });
        }

        const [result] = await pool.query(`
            INSERT INTO equipment
            (department_id, room_id, name, asset_code,
             total_quantity, available_quantity)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            department_id || null,
            room_id || null,
            name.trim(),
            asset_code.trim().toUpperCase(),
            quantity,
            quantity
        ]);

        res.status(201).json({
            message: "Equipment added successfully.",
            id: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({
            message: error.code === "ER_DUP_ENTRY"
                ? "That asset code already exists."
                : "Could not add equipment."
        });
    }
});

// Booking list: available for viewing
app.get("/api/bookings", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT bk.*, r.room_code, r.name AS room_name,
                   d.name AS department_name
            FROM bookings bk
            JOIN rooms r ON r.id = bk.room_id
            LEFT JOIN departments d ON d.id = bk.department_id
            ORDER BY bk.booking_date DESC, bk.start_time DESC
        `);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not load bookings." });
    }
});

// Submit booking request
app.post("/api/bookings", async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const {
            requester_name, requester_email, department_id,
            room_id, title, purpose, booking_date,
            start_time, end_time, attendees
        } = req.body;

        const count = Number(attendees);

        if (
            !requester_name?.trim() || !requester_email?.trim() ||
            !room_id || !title?.trim() || !booking_date ||
            !start_time || !end_time ||
            !Number.isInteger(count) || count <= 0 ||
            start_time >= end_time
        ) {
            return res.status(400).json({
                message: "Complete all booking fields with valid values."
            });
        }

        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(booking_date) ||
            Number.isNaN(Date.parse(booking_date + "T00:00:00"))
        ) {
            return res.status(400).json({ message: "Invalid booking date." });
        }

        if (booking_date < new Date().toLocaleDateString("en-CA")) {
            return res.status(400).json({
                message: "Bookings cannot be made for a past date."
            });
        }

        await connection.beginTransaction();

        const [roomRows] = await connection.query(
            "SELECT * FROM rooms WHERE id = ? FOR UPDATE",
            [room_id]
        );

        if (!roomRows.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Room not found." });
        }

        const room = roomRows[0];

        if (room.status !== "AVAILABLE") {
            await connection.rollback();
            return res.status(400).json({
                message: "This room is not currently available for booking."
            });
        }

        if (count > room.capacity) {
            await connection.rollback();
            return res.status(400).json({
                message: `Room capacity is ${room.capacity}. Reduce the attendee count.`
            });
        }

        const [conflicts] = await connection.query(`
            SELECT id FROM bookings
            WHERE room_id = ?
              AND booking_date = ?
              AND status IN ('PENDING', 'APPROVED')
              AND start_time < ?
              AND end_time > ?
            LIMIT 1
        `, [room_id, booking_date, end_time, start_time]);

        if (conflicts.length) {
            await connection.rollback();
            return res.status(409).json({
                message: "Booking conflict! This room already has a reservation during that time."
            });
        }

        const [result] = await connection.query(`
            INSERT INTO bookings
            (requester_name, requester_email, department_id,
             room_id, title, purpose, booking_date,
             start_time, end_time, attendees)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            requester_name.trim(),
            requester_email.trim(),
            department_id || null,
            room_id,
            title.trim(),
            purpose || null,
            booking_date,
            start_time,
            end_time,
            count
        ]);

        await connection.query(`
            INSERT INTO audit_logs
            (action, entity_type, entity_id, details)
            VALUES (?, ?, ?, ?)
        `, [
            "BOOKING_CREATED",
            "BOOKING",
            result.insertId,
            JSON.stringify({ room_id, booking_date, start_time, end_time })
        ]);

        await connection.commit();

        res.status(201).json({
            message: "Booking request submitted successfully.",
            id: result.insertId
        });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: "Could not create booking." });
    } finally {
        connection.release();
    }
});

// Management-only booking approval/rejection/cancellation
app.patch(
    "/api/bookings/:id/status",
    requireManagement,
    async (req, res) => {
        try {
            const { status } = req.body;
            const allowed = ["APPROVED", "REJECTED", "CANCELLED"];

            if (!allowed.includes(status)) {
                return res.status(400).json({
                    message: "Invalid booking status."
                });
            }

            const [result] = await pool.query(`
                UPDATE bookings
                SET status = ?
                WHERE id = ?
                  AND status IN ('PENDING', 'APPROVED')
            `, [status, req.params.id]);

            if (!result.affectedRows) {
                return res.status(404).json({
                    message: "Booking not found or already closed."
                });
            }

            await pool.query(`
                INSERT INTO audit_logs
                (action, entity_type, entity_id, details)
                VALUES (?, ?, ?, ?)
            `, [
                `BOOKING_${status}`,
                "BOOKING",
                req.params.id,
                JSON.stringify({ status })
            ]);

            res.json({
                message: `Booking ${status.toLowerCase()}.`
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                message: "Could not update booking."
            });
        }
    }
);

// Audit history
app.get("/api/audit", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100"
        );

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Could not load audit history." });
    }
});

// Error handler
app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ message: "Unexpected server error." });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        if (
            !process.env.SESSION_SECRET ||
            !process.env.MANAGEMENT_ID ||
            !process.env.MANAGEMENT_PASSWORD
        ) {
            throw new Error("Set SESSION_SECRET, MANAGEMENT_ID and MANAGEMENT_PASSWORD in .env");
        }

        await pool.query("SELECT 1");

        app.listen(PORT, () => {
            console.log("====================================");
            console.log("       VKIT SMART CAMPUS");
            console.log("====================================");
            console.log(`Server: http://localhost:${PORT}`);
            console.log("Database: Connected");
            console.log("Management authentication: Enabled");
            console.log("====================================");
        });
    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
}

startServer();
