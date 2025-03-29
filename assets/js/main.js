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

if (!authToken) {
  window.location.href = "/login.html";
}

let previousCharging = null;

// Function to show browser notifications
function showNotification(title, message) {
  console.log("Notification Triggered:", title, message);

  if (Notification.permission === "default") {
    Notification.requestPermission();
  }

  if (Notification.permission === "granted") {
    const notification = new Notification(title, {
      body: message,
      icon: "/assets/img/favicon.png",
      badge: "/assets/img/favicon.png",
      vibrate: [200, 100, 200],
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    showToast(title, message);
  }
}

// Function to show toast animation
function showToast(title, message) {
  const toast = document.createElement("div");
  toast.className = "notification-toast";
  toast.innerHTML = `<h4>${title}</h4><p>${message}</p>`;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Function to send battery data to backend
async function sendBatteryStatus() {
  if (!navigator.getBattery) {
    console.log("Battery API not supported");
    return;
  }

  const battery = await navigator.getBattery();

  async function updateBatteryStatus() {
    if (!userEmail) {
      console.error("User email is missing. Cannot send battery status.");
      return;
    }

    const batteryData = {
      email: userEmail,
      percentage: Math.round(battery.level * 100),
      charging: battery.charging,
    };

    console.log("Sending battery data:", batteryData);

    try {
      const response = await fetch(`${API_URL}/update_battery`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(batteryData),
      });

      if (!response.ok) {
        console.error("Error sending battery data:", await response.text());
      }
    } catch (error) {
      console.error("Failed to send battery data:", error);
    }
  }

  updateBatteryStatus();
  setInterval(updateBatteryStatus, 5000);

  battery.addEventListener("chargingchange", updateBatteryStatus);
  battery.addEventListener("levelchange", updateBatteryStatus);
}

// Function to fetch battery status from backend
async function fetchBatteryStatus() {
  if (!userEmail) {
    console.error("User email not found in localStorage.");
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/batterystatus?email=${userEmail}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error("Battery status error:", data.error);
    } else {
      updateBattery(data);
    }
  } catch (error) {
    console.error("Error fetching battery status:", error);
  }
}

// WebSocket connection function
function connectWebSocket() {
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsHost =
    window.location.hostname === "localhost"
      ? `ws://localhost:5000/ws`
      : `wss://batterysync-backend.onrender.com/ws`;

  const ws = new WebSocket(`${wsHost}?token=${authToken}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.error === "unauthorized") {
      localStorage.removeItem("authToken");
      window.location.href = "/login.html";
      return;
    }

    updateBattery(data);
  };

  ws.onerror = () => {
    console.log("WebSocket Error. Reconnecting...");
    setTimeout(connectWebSocket, 5000);
  };

  ws.onclose = () => {
    console.log("WebSocket Closed. Reconnecting...");
    setTimeout(connectWebSocket, 5000);
  };
}

// Function to update battery UI
function updateBattery(batt) {
  const level = batt.percentage;

  batteryLiquid.style.transition = "height 0.3s ease-in-out";
  batteryPercentage.innerHTML = level + "%";
  batteryLiquid.style.height = `${parseInt(level)}%`;

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

  if (level <= 20) {
    batteryLiquid.classList.add("gradient-color-red");
    batteryLiquid.classList.remove(
      "gradient-color-orange",
      "gradient-color-yellow",
      "gradient-color-green"
    );
  } else if (level <= 40) {
    batteryLiquid.classList.add("gradient-color-orange");
    batteryLiquid.classList.remove(
      "gradient-color-red",
      "gradient-color-yellow",
      "gradient-color-green"
    );
  } else if (level <= 80) {
    batteryLiquid.classList.add("gradient-color-yellow");
    batteryLiquid.classList.remove(
      "gradient-color-red",
      "gradient-color-orange",
      "gradient-color-green"
    );
  } else {
    batteryLiquid.classList.add("gradient-color-green");
    batteryLiquid.classList.remove(
      "gradient-color-red",
      "gradient-color-orange",
      "gradient-color-yellow"
    );
  }

  if (previousCharging !== batt.charging) {
    if (batt.charging) {
      showNotification("Charger Connected", "Battery is now charging");
    } else if (previousCharging !== null) {
      showNotification("Charger Disconnected", "Battery is on power save mode");
    }
    previousCharging = batt.charging;
  }

  if (level >= 90 && batt.charging) {
    showNotification(
      "Battery Full!",
      "Unplug the charger to save battery health."
    );
  }
}

// Run on page load
document.addEventListener("DOMContentLoaded", async () => {
  if (Notification.permission !== "granted") {
    await Notification.requestPermission();
  }
  sendBatteryStatus();
  fetchBatteryStatus(); // Fetch initial battery status
  connectWebSocket();
});
