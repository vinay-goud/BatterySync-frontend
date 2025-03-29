const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://batterysync-backend.onrender.com"; // ✅ Replace with your backend URL

async function handleSignup(e) {
  e.preventDefault();
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const errorMessage = document.getElementById("signup-error-message");

  try {
    const response = await fetch(`${API_URL}/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      }, // ✅ Set headers for JSON data
      credentials: "include",
      mode: "cors",
      body: JSON.stringify({ email, password }), // ✅ Send JSON data to backend
    });
    console.log("Signup response status:", response.status);
    const data = await response.json();
    console.log("Signup response:", data);
    if (response.status === 409) {
      errorMessage.textContent = "Email already exists. Try another.";
      return;
    }
    if (response.ok) {
      // ✅ Handle successful signup
      // Store email for login
      localStorage.setItem("lastEmail", email);
      window.location.href = "login.html"; // ✅ Redirect to login page after signup
    } else {
      errorMessage.textContent =
        data.detail || "Signup failed. Please Try again.";
    }
  } catch (error) {
    console.error("Signup error:", error);
    errorMessage.textContent = "Connection error. Please try again.";
  }
}

// ✅ Initialize signup form event listener
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("signupForm")
    .addEventListener("submit", handleSignup);
});
