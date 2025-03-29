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
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok && data.token) {
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("userEmail", email);
      window.location.href = "/";
    } else {
      errorMessage.textContent =
        data.message || "Login failed. Please try again.";
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
