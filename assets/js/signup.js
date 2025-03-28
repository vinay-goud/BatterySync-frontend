const API_URL = "https://your-backend-url.com"; // Replace with your backend URL

async function handleSignup(e) {
  e.preventDefault();
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const errorMessage = document.getElementById("signup-error-message");

  try {
    const response = await fetch(`${API_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // Redirect to login page after successful signup
      window.location.href = "login.html";
    } else {
      errorMessage.textContent = data.message || "Signup failed. Try again.";
    }
  } catch (error) {
    console.error("Signup error:", error);
    errorMessage.textContent = "Connection error. Please try again.";
  }
}

// Initialize signup form
document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm");
  signupForm.addEventListener("submit", handleSignup);
});
