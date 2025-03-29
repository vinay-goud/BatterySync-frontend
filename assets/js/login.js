const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://batterysync-backend.onrender.com";

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const errorMessage = document.getElementById("error-message");

  try {
    console.log("Attempting login for:", email);
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    console.log("Login response:", data);

    if (response.ok && data.access_token) {
      // Store the token and email in localStorage
      localStorage.setItem("authToken", data.access_token);
      localStorage.setItem("userEmail", email);
      window.location.href = "/";
    } else {
      errorMessage.textContent =
        data.detail || "Login failed. Please try again.";
      console.error("Login failed:", data);
    }
  } catch (error) {
    console.error("Login error:", error);
    errorMessage.textContent = "Connection error. Please try again later.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  loginForm.addEventListener("submit", handleLogin);
});
