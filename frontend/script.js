/* =========================================================
   ApplyTrack — script.js
   Handles all communication with the FastAPI backend and
   updates the DOM (HTML) based on the data received.
   ========================================================= */

// Base URL of our FastAPI backend. Change this if you host the backend elsewhere.
const API_BASE_URL = "https://applytrack-ipeq.onrender.com";

// ---------------------------------------------------------------------------
// DOM Element References
// ---------------------------------------------------------------------------
const tableBody = document.getElementById("applicationsTableBody");
const emptyState = document.getElementById("emptyState");

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");

const openAddModalBtn = document.getElementById("openAddModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelBtn = document.getElementById("cancelBtn");
const modalOverlay = document.getElementById("applicationModal");
const modalTitle = document.getElementById("modalTitle");
const applicationForm = document.getElementById("applicationForm");

// Form fields
const applicationIdField = document.getElementById("applicationId");
const companyNameField = document.getElementById("companyName");
const jobRoleField = document.getElementById("jobRole");
const jobUrlField = document.getElementById("jobUrl");
const statusField = document.getElementById("status");
const dateAppliedField = document.getElementById("dateApplied");

// Stat elements
const statTotal = document.getElementById("statTotal");
const statApplied = document.getElementById("statApplied");
const statInterview = document.getElementById("statInterview");
const statOffer = document.getElementById("statOffer");
const statRejected = document.getElementById("statRejected");

// ---------------------------------------------------------------------------
// API FUNCTIONS
// These functions are the only place in the app that talk to the backend.
// ---------------------------------------------------------------------------

/**
 * Fetch applications from the backend, optionally filtered by status
 * and/or a search term. Then render them into the table.
 */
async function fetchApplications() {
  try {
    // Build query string based on current filter/search values
    const params = new URLSearchParams();
    if (statusFilter.value) params.append("status", statusFilter.value);
    if (searchInput.value.trim()) params.append("search", searchInput.value.trim());

    const response = await fetch(`${API_BASE_URL}/applications?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch applications (status ${response.status})`);
    }

    const applications = await response.json();
    renderApplications(applications);
  } catch (error) {
    console.error(error);
    alert("Could not load applications. Is the backend server running?");
  }
}

/**
 * Fetch dashboard statistics and update the stat cards.
 */
async function fetchStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/stats`);

    if (!response.ok) {
      throw new Error(`Failed to fetch stats (status ${response.status})`);
    }

    const stats = await response.json();

    statTotal.textContent = stats.total;
    statApplied.textContent = stats.applied;
    statInterview.textContent = stats.interview;
    statOffer.textContent = stats.offer;
    statRejected.textContent = stats.rejected;
  } catch (error) {
    console.error(error);
  }
}

/**
 * Send a POST request to create a new application.
 */
async function createApplication(applicationData) {
  const response = await fetch(`${API_BASE_URL}/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(applicationData),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || "Failed to create application");
  }

  return response.json();
}

/**
 * Send a PUT request to update an existing application by id.
 */
async function updateApplication(id, applicationData) {
  const response = await fetch(`${API_BASE_URL}/applications/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(applicationData),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || "Failed to update application");
  }

  return response.json();
}

/**
 * Send a DELETE request to remove an application by id.
 */
async function deleteApplication(id) {
  const response = await fetch(`${API_BASE_URL}/applications/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || "Failed to delete application");
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// RENDERING
// ---------------------------------------------------------------------------

/**
 * Take an array of application objects and render them as table rows.
 */
function renderApplications(applications) {
  tableBody.innerHTML = ""; // Clear existing rows before re-rendering

  if (applications.length === 0) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  applications.forEach((app) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(app.company_name)}</td>
      <td>${escapeHtml(app.job_role)}</td>
      <td><span class="badge badge-${app.status}">${app.status}</span></td>
      <td>${app.date_applied}</td>
      <td>${
        app.job_url
          ? `<a class="job-link" href="${escapeHtml(app.job_url)}" target="_blank" rel="noopener">View</a>`
          : "—"
      }</td>
      <td class="actions-cell">
        <button class="btn-icon" onclick="handleEditClick(${app.id})">Edit</button>
        <button class="btn-icon danger" onclick="handleDeleteClick(${app.id})">Delete</button>
      </td>
    `;

    tableBody.appendChild(row);
  });
}

/**
 * Basic protection against HTML injection when inserting text into the DOM.
 */
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// MODAL HANDLING
// ---------------------------------------------------------------------------

function openModal(mode = "add", application = null) {
  applicationForm.reset();

  if (mode === "edit" && application) {
    modalTitle.textContent = "Edit Application";
    applicationIdField.value = application.id;
    companyNameField.value = application.company_name;
    jobRoleField.value = application.job_role;
    jobUrlField.value = application.job_url || "";
    statusField.value = application.status;
    dateAppliedField.value = application.date_applied;
  } else {
    modalTitle.textContent = "Add Application";
    applicationIdField.value = "";
  }

  modalOverlay.classList.remove("hidden");
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  applicationForm.reset();
}

// ---------------------------------------------------------------------------
// EVENT HANDLERS
// ---------------------------------------------------------------------------

/**
 * Called when the user clicks "Edit" on a row.
 * We fetch the single application's data, then open the modal pre-filled.
 */
async function handleEditClick(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/applications/${id}`);
    if (!response.ok) throw new Error("Could not find that application");
    const application = await response.json();
    openModal("edit", application);
  } catch (error) {
    console.error(error);
    alert("Something went wrong while loading this application.");
  }
}

/**
 * Called when the user clicks "Delete" on a row.
 */
async function handleDeleteClick(id) {
  const confirmed = confirm("Are you sure you want to delete this application?");
  if (!confirmed) return;

  try {
    await deleteApplication(id);
    await fetchApplications();
    await fetchStats();
  } catch (error) {
    console.error(error);
    alert("Failed to delete the application.");
  }
}

/**
 * Called when the Add/Edit form is submitted.
 * Decides whether to create a new application or update an existing one.
 */
applicationForm.addEventListener("submit", async (event) => {
  event.preventDefault(); // Stop the browser from doing a full page reload

  const applicationData = {
    company_name: companyNameField.value.trim(),
    job_role: jobRoleField.value.trim(),
    job_url: jobUrlField.value.trim() || null,
    status: statusField.value,
    date_applied: dateAppliedField.value,
  };

  const existingId = applicationIdField.value;

  try {
    if (existingId) {
      await updateApplication(existingId, applicationData);
    } else {
      await createApplication(applicationData);
    }

    closeModal();
    await fetchApplications();
    await fetchStats();
  } catch (error) {
    console.error(error);
    alert(error.message || "Failed to save the application.");
  }
});

// Open/close modal buttons
openAddModalBtn.addEventListener("click", () => openModal("add"));
closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);

// Close modal when clicking outside the modal box
modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) closeModal();
});

// Re-fetch applications whenever search or filter changes
searchInput.addEventListener("input", debounce(fetchApplications, 300));
statusFilter.addEventListener("change", fetchApplications);

/**
 * Debounce helper: prevents fetchApplications() from firing on every
 * single keystroke — it waits until the user pauses typing.
 */
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// ---------------------------------------------------------------------------
// INITIAL LOAD
// ---------------------------------------------------------------------------
fetchApplications();
fetchStats();
