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

// Redirect to login if no auth token
if (!authToken || !userEmail) {
  window.location.href = "/login.html";
}

let previousCharging = null;

// Function to show browser notifications
async function showNotification(title, message) {
  console.log("Notification Triggered:", title, message);

  try {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }

      if (Notification.permission === "granted") {
        const notification = new Notification(title, {
          body: message,
          icon: "/assets/img/icon-192.png",
          badge: "/assets/img/icon-192.png",
          vibrate: [200, 100, 200],
          requireInteraction: true,
          sound: "/assets/audio/notification.mp3",
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
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
        throw new Error(await response.text());
      }
    } catch (error) {
      console.error("Failed to send battery data:", error);
    }
  }

  // Initial update and set interval
  await updateBatteryStatus();
  setInterval(updateBatteryStatus, 5000);

  // Add battery event listeners
  battery.addEventListener("chargingchange", updateBatteryStatus);
  battery.addEventListener("levelchange", updateBatteryStatus);
}

// Function to fetch battery status from backend
async function fetchBatteryStatus() {
  if (!userEmail || !authToken) {
    console.error("Missing user credentials");
    window.location.href = "/login.html";
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/batterystatus?email=${userEmail}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();
    if (!data.error) {
      updateBattery(data);
    }
  } catch (error) {
    console.error("Error fetching battery status:", error);
  }
}

// WebSocket connection function
function connectWebSocket() {
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsURL =
    window.location.hostname === "localhost"
      ? `ws://localhost:5000/ws`
      : `wss://batterysync-backend.onrender.com/ws`;

  const ws = new WebSocket(`${wsURL}?token=${authToken}&email=${userEmail}`);

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

  // Check charging state changes
  if (previousCharging !== batt.charging) {
    if (batt.charging) {
      showNotification("Charger Connected", "Battery is now charging");
    } else if (previousCharging !== null) {
      showNotification("Charger Disconnected", "Battery is on power save mode");
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
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", async () => {
  if (!authToken || !userEmail) {
    window.location.href = "/login.html";
    return;
  }

  if (Notification.permission !== "granted") {
    await Notification.requestPermission();
  }

  // Start all services
  await sendBatteryStatus();
  await fetchBatteryStatus();
  connectWebSocket();
});
