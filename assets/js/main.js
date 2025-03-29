/*=============== BATTERY ===============*/
const batteryLiquid = document.querySelector(".battery__liquid"),
  batteryStatus = document.querySelector(".battery__status"),
  batteryPercentage = document.querySelector(".battery__percentage");

const authToken = localStorage.getItem("authToken");
const userEmail = localStorage.getItem("userEmail");
const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://batterysync-backend.onrender.com";

// Check authentication before proceeding
if (!authToken || !userEmail) {
  console.log("No auth token or email found, redirecting to login");
  window.location.href = "/login.html";
}

let previousCharging = null;
let wsReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Function to show browser notifications
async function showNotification(title, message) {
  console.log("Notification Triggered:", title, message);

  try {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.log("Notification permission denied");
          return;
        }
      }

      if (Notification.permission === "granted") {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          body: message,
          icon: "/assets/img/icon-192.png",
          badge: "/assets/img/icon-192.png",
          vibrate: [200, 100, 200],
          requireInteraction: true,
          sound: "/assets/audio/notification.mp3",
        });
      }
    }
  } catch (error) {
    console.error("Notification error:", error);
  }

  // Always show toast
  showToast(title, message);
}

// Function to show toast animation
function showToast(title, message) {
  try {
    const existingToast = document.querySelector(".notification-toast");
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement("div");
    toast.className = "notification-toast";
    toast.innerHTML = `<h4>${title}</h4><p>${message}</p>`;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  } catch (error) {
    console.error("Toast error:", error);
  }
}

// Function to handle auth errors
function handleAuthError() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("userEmail");
  window.location.href = "/login.html";
}

// Function to send battery data to backend
async function sendBatteryStatus() {
  if (!navigator.getBattery) {
    console.error("Battery API not supported");
    showToast("Error", "Battery API not supported on this device");
    return;
  }

  try {
    const battery = await navigator.getBattery();

    async function updateBatteryStatus() {
      if (!userEmail || !authToken) {
        console.error("Missing credentials");
        handleAuthError();
        return;
      }

      const batteryData = {
        email: userEmail,
        percentage: Math.round(battery.level * 100),
        charging: battery.charging,
      };

      try {
        const response = await fetch(`${API_URL}/update_battery`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(batteryData),
        });

        if (response.status === 401) {
          handleAuthError();
          return;
        }

        if (!response.ok) {
          throw new Error(await response.text());
        }
      } catch (error) {
        console.error("Failed to send battery data:", error);
        showToast("Error", "Failed to update battery status");
      }
    }

    // Initial update and set interval
    await updateBatteryStatus();
    const intervalId = setInterval(updateBatteryStatus, 5000);

    // Add battery event listeners
    battery.addEventListener("chargingchange", updateBatteryStatus);
    battery.addEventListener("levelchange", updateBatteryStatus);

    // Cleanup function
    return () => {
      clearInterval(intervalId);
      battery.removeEventListener("chargingchange", updateBatteryStatus);
      battery.removeEventListener("levelchange", updateBatteryStatus);
    };
  } catch (error) {
    console.error("Battery API error:", error);
    showToast("Error", "Failed to access battery information");
  }
}

// Function to fetch battery status from backend
async function fetchBatteryStatus() {
  if (!userEmail || !authToken) {
    console.error("Missing credentials");
    handleAuthError();
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/batterystatus?email=${encodeURIComponent(userEmail)}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.status === 401) {
      handleAuthError();
      return;
    }

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();
    if (data.error) {
      console.error("Battery status error:", data.error);
      return;
    }

    updateBattery(data);
  } catch (error) {
    console.error("Error fetching battery status:", error);
    showToast("Error", "Failed to fetch battery status");
  }
}

// WebSocket connection function
function connectWebSocket() {
  if (wsReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error("Max WebSocket reconnection attempts reached");
    showToast("Error", "Connection lost. Please refresh the page.");
    return;
  }

  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsURL =
    window.location.hostname === "localhost"
      ? `ws://localhost:5000/ws`
      : `wss://batterysync-backend.onrender.com/ws`;

  try {
    const ws = new WebSocket(
      `${wsURL}?token=${encodeURIComponent(
        authToken
      )}&email=${encodeURIComponent(userEmail)}`
    );

    ws.onopen = () => {
      console.log("WebSocket connected");
      wsReconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error === "unauthorized") {
          handleAuthError();
          return;
        }
        updateBattery(data);
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      wsReconnectAttempts++;
    };

    ws.onclose = () => {
      console.log("WebSocket closed. Reconnecting...");
      setTimeout(() => connectWebSocket(), 5000);
      wsReconnectAttempts++;
    };

    return ws;
  } catch (error) {
    console.error("WebSocket connection error:", error);
    wsReconnectAttempts++;
    setTimeout(() => connectWebSocket(), 5000);
  }
}

// Function to update battery UI
function updateBattery(batt) {
  try {
    const level = batt.percentage;

    batteryLiquid.style.transition = "height 0.3s ease-in-out";
    batteryPercentage.innerHTML = level + "%";
    batteryLiquid.style.height = `${parseInt(level)}%`;

    // Update battery status text and icon
    if (level == 100) {
      batteryStatus.innerHTML = `Full battery <i class="ri-battery-2-fill green-color"></i>`;
      batteryLiquid.style.height = "103%";
    } else if (level <= 20 && !batt.charging) {
      batteryStatus.innerHTML = `Low battery <i class="ri-plug-line animated-red"></i>`;
    } else if (batt.charging) {
      batteryStatus.innerHTML = `Charging... <i class="ri-flashlight-line animated-green"></i>`;
    } else {
      batteryStatus.innerHTML = "";
    }

    // Update battery color
    batteryLiquid.classList.remove(
      "gradient-color-red",
      "gradient-color-orange",
      "gradient-color-yellow",
      "gradient-color-green"
    );

    if (level <= 20) {
      batteryLiquid.classList.add("gradient-color-red");
    } else if (level <= 40) {
      batteryLiquid.classList.add("gradient-color-orange");
    } else if (level <= 80) {
      batteryLiquid.classList.add("gradient-color-yellow");
    } else {
      batteryLiquid.classList.add("gradient-color-green");
    }

    // Handle charging state changes
    if (previousCharging !== batt.charging) {
      if (batt.charging) {
        showNotification("Charger Connected", "Battery is now charging");
      } else if (previousCharging !== null) {
        showNotification(
          "Charger Disconnected",
          "Battery is on power save mode"
        );
      }
      previousCharging = batt.charging;
    }

    // Show full battery notification
    if (level >= 90 && batt.charging) {
      showNotification(
        "Battery Full!",
        "Unplug the charger to save battery health."
      );
    }
  } catch (error) {
    console.error("Error updating battery UI:", error);
    showToast("Error", "Failed to update battery display");
  }
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (!authToken || !userEmail) {
      handleAuthError();
      return;
    }

    // Request notification permission
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }

    // Register service worker if not already registered
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register(
          "/service-worker.js"
        );
        console.log("ServiceWorker registered:", registration);
      } catch (error) {
        console.error("ServiceWorker registration failed:", error);
      }
    }

    // Start all services
    const cleanup = await sendBatteryStatus();
    await fetchBatteryStatus();
    const ws = connectWebSocket();

    // Cleanup on page unload
    window.addEventListener("unload", () => {
      if (cleanup) cleanup();
      if (ws) ws.close();
    });
  } catch (error) {
    console.error("Initialization error:", error);
    showToast("Error", "Failed to initialize application");
  }
});
