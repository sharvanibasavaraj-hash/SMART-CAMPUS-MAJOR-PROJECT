const API = "/api";

let departments = [];
let rooms = [];
let equipment = [];
let bookings = [];
let isManagement = false;

const $ = (id) => document.getElementById(id);

// Escape HTML so database values cannot break the page.
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// Notifications
function toast(message) {
    const box = $("toast");

    box.textContent = message;
    box.classList.add("show");

    clearTimeout(window.toastTimer);

    window.toastTimer = setTimeout(() => {
        box.classList.remove("show");
    }, 3000);
}

// API connection
async function api(url, options = {}) {
    const response = await fetch(API + url, {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
    }

    return data;
}

function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
}

function statusBadge(status) {
    return `<span class="status status-${escapeHTML(status)}">${escapeHTML(String(status).replaceAll("_", " "))}</span>`;
}

function emptyRow(columns, message) {
    return `<tr><td colspan="${columns}" class="empty-row">${escapeHTML(message)}</td></tr>`;
}

// Navigation
function navigate(page) {
    document.querySelectorAll(".page").forEach(section => {
        section.classList.toggle("active", section.id === page);
    });

    document.querySelectorAll(".nav-item").forEach(button => {
        button.classList.toggle("active", button.dataset.page === page);
    });

    const titles = {
        dashboard: "Campus Overview",
        departments: "Department Management",
        rooms: "Rooms & Laboratories",
        bookings: "Resource Reservations",
        equipment: "Equipment Inventory"
    };

    $("page-title").textContent = titles[page] || "VKIT Smart Campus";

    if (page === "dashboard") loadDashboard();
    if (page === "departments") loadDepartments();
    if (page === "rooms") loadRooms();
    if (page === "bookings") loadBookings();
    if (page === "equipment") loadEquipment();
}

document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
        navigate(button.dataset.page);
    });
});

document.querySelectorAll("[data-goto]").forEach(button => {
    button.addEventListener("click", () => {
        navigate(button.dataset.goto);
    });
});

// Form visibility
function connectForm(buttonId, formId) {
    $(buttonId).addEventListener("click", () => {
        $(formId).classList.remove("hidden");

        $(formId).scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    });

    $(formId).querySelector(".cancel-form").addEventListener("click", () => {
        $(formId).reset();
        $(formId).classList.add("hidden");
    });
}

connectForm("show-department-form", "department-form");
connectForm("show-room-form", "room-form");
connectForm("show-booking-form", "booking-form");
connectForm("show-equipment-form", "equipment-form");

// Dashboard
async function loadDashboard() {
    try {
        const data = await api("/dashboard");

        const total = Number(data.rooms.total || 0);
        const available = Number(data.rooms.available || 0);

        const percentage = total
            ? Math.round(available / total * 100)
            : 0;

        $("total-rooms").textContent = total;
        $("available-rooms").textContent = available;

        $("total-bookings").textContent =
            Number(data.bookings.total || 0);

        $("pending-bookings").textContent =
            Number(data.bookings.pending || 0);

        $("util-number").textContent = percentage + "%";
        $("util-bar").style.width = percentage + "%";

        $("equipment-total").textContent =
            Number(data.equipment.total || 0);

        $("equipment-available").textContent =
            Number(data.equipment.available || 0);

        $("equipment-types").textContent =
            Number(data.equipment.types || 0);

        const latest = await api("/bookings");

        $("recent-bookings").innerHTML =
            latest.slice(0, 5).map(item => `
                <tr>
                    <td>
                        <strong>${escapeHTML(item.title)}</strong>
                    </td>
                    <td>${escapeHTML(item.room_code)}</td>
                    <td>${escapeHTML(item.booking_date)}</td>
                    <td>${statusBadge(item.status)}</td>
                </tr>
            `).join("") || emptyRow(4, "No booking requests yet.");

    } catch (error) {
        toast(error.message);
    }
}

// Departments
async function loadDepartments() {
    try {
        departments = await api("/departments");

        $("department-list").innerHTML =
            departments.map(dept => `
                <tr>
                    <td>
                        <strong>${escapeHTML(dept.code)}</strong>
                    </td>
                    <td>${escapeHTML(dept.name)}</td>
                    <td>${Number(dept.room_count)}</td>
                </tr>
            `).join("") || emptyRow(3, "No departments registered yet.");

        updateDepartmentSelects();

    } catch (error) {
        toast(error.message);
    }
}

function updateDepartmentSelects() {
    const options = departments.map(dept => `
        <option value="${dept.id}">
            ${escapeHTML(dept.code)} — ${escapeHTML(dept.name)}
        </option>
    `).join("");

    [
        "room-department",
        "booking-department",
        "equipment-department"
    ].forEach(id => {
        const select = $(id);

        const firstOption = select.options[0]
            ? select.options[0].outerHTML
            : "";

        select.innerHTML = firstOption + options;
    });
}

$("department-form").addEventListener("submit", async event => {
    event.preventDefault();

    try {
        await api("/departments", {
            method: "POST",
            body: JSON.stringify(formData(event.target))
        });

        toast("Department added successfully.");

        event.target.reset();
        event.target.classList.add("hidden");

        await loadDepartments();
        await loadDashboard();

    } catch (error) {
        toast(error.message);
    }
});

// Buildings
async function loadBuildings() {
    const buildings = await api("/buildings");

    $("room-building").innerHTML =
        '<option value="">Select building</option>' +
        buildings.map(building => `
            <option value="${building.id}">
                ${escapeHTML(building.name)}
            </option>
        `).join("");
}

// Rooms
async function loadRooms() {
    try {
        rooms = await api("/rooms");

        renderRooms();
        updateRoomSelects();

    } catch (error) {
        toast(error.message);
    }
}

function renderRooms() {
    const search = $("room-search").value.toLowerCase();
    const type = $("room-filter").value;

    const filtered = rooms.filter(room =>
        (
            String(room.name || "").toLowerCase().includes(search) ||
            String(room.room_code || "").toLowerCase().includes(search)
        ) &&
        (!type || room.type === type)
    );

    $("room-list").innerHTML =
        filtered.map(room => `
            <tr>
                <td>
                    <strong>${escapeHTML(room.room_code)}</strong><br>
                    <span class="muted">${escapeHTML(room.name)}</span>
                </td>

                <td>${statusBadge(room.type)}</td>

                <td>${escapeHTML(room.department_name || "Shared")}</td>

                <td>${Number(room.capacity)}</td>

                <td>${statusBadge(room.status)}</td>

                <td>
                    <select class="action-btn room-status" data-id="${room.id}">
                        <option value="">Change status</option>
                        <option value="AVAILABLE">Available</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="INACTIVE">Inactive</option>
                    </select>
                </td>
            </tr>
        `).join("") || emptyRow(6, "No matching rooms found.");

    document.querySelectorAll(".room-status").forEach(select => {
        select.addEventListener("change", async () => {
            if (!select.value) return;

            try {
                await api(`/rooms/${select.dataset.id}/status`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        status: select.value
                    })
                });

                toast("Room status updated.");

                await loadRooms();
                await loadDashboard();

            } catch (error) {
                toast(error.message);
            }
        });
    });
}

function updateRoomSelects() {
    const available = rooms.filter(room =>
        room.status === "AVAILABLE"
    );

    $("booking-room").innerHTML =
        '<option value="">Select room</option>' +
        available.map(room => `
            <option value="${room.id}">
                ${escapeHTML(room.room_code)} — ${escapeHTML(room.name)}
                (Capacity ${Number(room.capacity)})
            </option>
        `).join("");

    $("equipment-room").innerHTML =
        '<option value="">Not assigned</option>' +
        rooms.map(room => `
            <option value="${room.id}">
                ${escapeHTML(room.room_code)} — ${escapeHTML(room.name)}
            </option>
        `).join("");
}

$("room-form").addEventListener("submit", async event => {
    event.preventDefault();

    try {
        await api("/rooms", {
            method: "POST",
            body: JSON.stringify(formData(event.target))
        });

        toast("Room registered successfully.");

        event.target.reset();
        event.target.classList.add("hidden");

        await loadRooms();
        await loadDashboard();
        await loadDepartments();

    } catch (error) {
        toast(error.message);
    }
});

$("room-search").addEventListener("input", renderRooms);
$("room-filter").addEventListener("change", renderRooms);

// Equipment
async function loadEquipment() {
    try {
        equipment = await api("/equipment");

        $("equipment-list").innerHTML =
            equipment.map(item => `
                <tr>
                    <td>
                        <strong>${escapeHTML(item.asset_code)}</strong>
                    </td>

                    <td>${escapeHTML(item.name)}</td>

                    <td>${escapeHTML(item.department_name || "Shared")}</td>

                    <td>${escapeHTML(item.room_code || "Unassigned")}</td>

                    <td>
                        ${Number(item.available_quantity)}
                        /
                        ${Number(item.total_quantity)}
                    </td>

                    <td>${statusBadge(item.condition_status)}</td>
                </tr>
            `).join("") || emptyRow(6, "No equipment registered yet.");

    } catch (error) {
        toast(error.message);
    }
}

$("equipment-form").addEventListener("submit", async event => {
    event.preventDefault();

    try {
        await api("/equipment", {
            method: "POST",
            body: JSON.stringify(formData(event.target))
        });

        toast("Equipment registered successfully.");

        event.target.reset();
        event.target.classList.add("hidden");

        await loadEquipment();
        await loadDashboard();

    } catch (error) {
        toast(error.message);
    }
});

// Bookings
async function loadBookings() {
    try {
        bookings = await api("/bookings");
        renderBookings();

    } catch (error) {
        toast(error.message);
    }
}

function renderBookings() {
    const filter = $("booking-filter").value;

    const filtered = bookings.filter(item =>
        !filter || item.status === filter
    );

    $("booking-list").innerHTML =
        filtered.map(item => `
            <tr>
                <td>
                    <strong>${escapeHTML(item.title)}</strong><br>
                    <span class="muted">
                        ${escapeHTML(item.purpose || "")}
                    </span>
                </td>

                <td>${escapeHTML(item.requester_name)}</td>

                <td>${escapeHTML(item.room_code)}</td>

                <td>
                    ${escapeHTML(item.booking_date)}<br>

                    <span class="muted">
                        ${escapeHTML(String(item.start_time).slice(0, 5))}
                        –
                        ${escapeHTML(String(item.end_time).slice(0, 5))}
                    </span>
                </td>

                <td>${statusBadge(item.status)}</td>

                <td>
                    ${!isManagement ? `
                        <span class="muted">Management only</span>
                    ` : item.status === "PENDING" ? `
                        <button
                            class="action-btn approve-btn"
                            data-id="${item.id}">
                            Approve
                        </button>

                        <button
                            class="action-btn reject-btn"
                            data-id="${item.id}">
                            Reject
                        </button>
                    ` : item.status === "APPROVED" ? `
                        <button
                            class="action-btn cancel-booking-btn"
                            data-id="${item.id}">
                            Cancel
                        </button>
                    ` : "—"}
                </td>
            </tr>
        `).join("") || emptyRow(6, "No booking requests found.");

    document.querySelectorAll(".approve-btn").forEach(button => {
        button.addEventListener("click", () => {
            changeBookingStatus(button.dataset.id, "APPROVED");
        });
    });

    document.querySelectorAll(".reject-btn").forEach(button => {
        button.addEventListener("click", () => {
            changeBookingStatus(button.dataset.id, "REJECTED");
        });
    });

    document.querySelectorAll(".cancel-booking-btn").forEach(button => {
        button.addEventListener("click", () => {
            changeBookingStatus(button.dataset.id, "CANCELLED");
        });
    });
}

async function changeBookingStatus(id, status) {
    if (!isManagement) {
        toast("Please log in as management first.");
        return;
    }

    try {
        await api(`/bookings/${id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status })
        });

        toast(`Booking ${status.toLowerCase()}.`);

        await loadBookings();
        await loadDashboard();

    } catch (error) {
        toast(error.message);
    }
}

$("booking-filter").addEventListener("change", renderBookings);

$("booking-form").addEventListener("submit", async event => {
    event.preventDefault();

    try {
        await api("/bookings", {
            method: "POST",
            body: JSON.stringify(formData(event.target))
        });

        toast("Booking request submitted.");

        event.target.reset();
        event.target.classList.add("hidden");

        await loadBookings();
        await loadDashboard();

    } catch (error) {
        toast(error.message);
    }
});

// Management login and logout
const managementModal = $("management-modal");

$("management-login-btn").addEventListener("click", () => {
    $("management-error").textContent = "";
    managementModal.classList.remove("hidden");
    $("management-id").focus();
});

$("close-management-login").addEventListener("click", () => {
    managementModal.classList.add("hidden");
    $("management-error").textContent = "";
});

managementModal.addEventListener("click", event => {
    if (event.target === managementModal) {
        managementModal.classList.add("hidden");
    }
});

$("management-login-form").addEventListener("submit", async event => {
    event.preventDefault();

    const errorBox = $("management-error");
    const loginButton = event.target.querySelector('button[type="submit"]');

    errorBox.textContent = "";
    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";

    try {
        await api("/management/login", {
            method: "POST",
            body: JSON.stringify({
                managementId: $("management-id").value.trim(),
                password: $("management-password").value
            })
        });

        isManagement = true;

        managementModal.classList.add("hidden");

        $("management-login-btn").classList.add("hidden");
        $("management-logout-btn").classList.remove("hidden");

        event.target.reset();

        await loadBookings();

        toast("Management login successful.");

    } catch (error) {
        errorBox.textContent = error.message;

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Login";
    }
});

$("management-logout-btn").addEventListener("click", async () => {
    try {
        await api("/management/logout", {
            method: "POST"
        });

        isManagement = false;

        $("management-login-btn").classList.remove("hidden");
        $("management-logout-btn").classList.add("hidden");

        await loadBookings();

        toast("Logged out successfully.");

    } catch (error) {
        toast(error.message);
    }
});

// Check whether management is already logged in.
async function checkManagementSession() {
    try {
        const session = await api("/management/session");

        isManagement = Boolean(session.loggedIn);

    } catch (error) {
        isManagement = false;
    }

    $("management-login-btn").classList.toggle("hidden", isManagement);
    $("management-logout-btn").classList.toggle("hidden", !isManagement);
}

// Initial setup
async function initialize() {
    $("booking-date").min = new Date().toLocaleDateString("en-CA");

    try {
        await loadDepartments();
        await loadBuildings();
        await loadRooms();
        await loadEquipment();
        await loadBookings();
        await loadDashboard();

    } catch (error) {
        toast(error.message);
    }
}

// Refresh button
$("refresh-btn").addEventListener("click", async () => {
    await initialize();
    toast("Campus information refreshed.");
});

// Start application
async function startApplication() {
    await checkManagementSession();
    await initialize();
}

startApplication();