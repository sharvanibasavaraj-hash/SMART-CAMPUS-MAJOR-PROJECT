# Smart Campus Management System

A modern, web-based Smart Campus Management System designed to simplify campus resource management and room booking. The application provides a centralized platform to manage departments, buildings, rooms, equipment, and booking requests.

It allows users to submit room booking requests and enables management to review, approve, or reject those requests.

## Features

- **Department Management:** Organize and manage campus departments.
- **Building Management:** Maintain building information.
- **Room Management:** View and manage available rooms.
- **Equipment Management:** Maintain records of campus equipment.
- **Room Booking:** Submit requests for booking rooms and labs.
- **Booking Approval:** Allow management to approve or reject booking requests.
- **Management Login:** Secure login for authorized management access.
- **Notifications:** Maintain notifications related to campus activities.
- **Audit Logs:** Track important system activities.
- **Database Storage:** Store campus information and booking records using MySQL.

## Technologies Used

| **Technology** | **Purpose** |
|---|---|
| HTML | Structure of the application |
| CSS | Styling and user interface |
| JavaScript | Frontend functionality |
| Node.js | Backend runtime |
| Express.js | Server and API development |
| MySQL | Database management |
| Express Session | Management session handling |
| dotenv | Environment variable management |

## Project Structure

All files are maintained in a single folder.

```text
VKIT-SMART-CAMPUS/
│
├── index.html
├── style.css
├── script.js
├── server.js
├── database.js
├── schema.sql
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

## Database

**Database Name:** `vkit_smart_campus`

The database includes tables for:

| **Table** | **Purpose** |
|---|---|
| departments | Stores department information |
| buildings | Stores building details |
| rooms | Stores room information |
| equipment | Maintains equipment records |
| bookings | Stores room booking requests |
| audit_logs | Tracks system activities |
| notifications | Stores notifications |

## Installation and Setup

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Open the Project Folder

```bash
cd VKIT-SMART-CAMPUS
```

### 3. Create the MySQL Database

Open MySQL Workbench and execute the SQL commands in `schema.sql` to create the database and required tables.

### 4. Configure Environment Variables

Create a local `.env` file:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=vkit_smart_campus
MANAGEMENT_ID=your_management_id
MANAGEMENT_PASSWORD=your_management_password
SESSION_SECRET=your_session_secret
```

Replace the sample values with your own credentials. Do not upload `.env` to GitHub.

### 5. Install Dependencies

```bash
npm install
```

### 6. Start the Application

```bash
node server.js
```

### 7. Open in Browser

Visit:

```text
http://localhost:5000
```

## How It Works

1. Users access the Smart Campus application.
2. Campus departments, buildings, rooms, and equipment are displayed.
3. Users submit booking requests for rooms or labs.
4. Booking requests are stored in the MySQL database with a pending status.
5. Management logs in through the application.
6. Management reviews booking requests and approves or rejects them.
7. The system maintains notifications and activity records.

## Learning Outcomes

- Understanding full-stack web application development.
- Building backend services using Node.js and Express.js.
- Connecting applications to MySQL.
- Designing and managing relational databases.
- Implementing CRUD operations.
- Developing session-based authentication.
- Managing booking workflows and approval systems.
- Working with database relationships and audit logs.

## Project Type

Full-Stack Web Development Project
