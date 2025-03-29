/*=============== BATTERY ===============*/
const batteryLiquid = document.querySelector(".battery__liquid"),
  batteryStatusElem = document.querySelector(".battery__status"), // renamed for clarity
  batteryPercentage = document.querySelector(".battery__percentage");

// Device identification using modern APIs
let deviceId;
(async () => {
  deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    try {
      const hints = await navigator.userAgentData?.getHighEntropyValues([
        "platform",
        "platformVersion",
        "model",
      ]);
      if (hints) {
        deviceId = `${hints.platform}-${hints.model || "unknown"}-${crypto
          .randomUUID()
          .slice(0, 8)}`;
      } else {
        const userAgent = navigator.userAgent;
        const platform =
          /Windows|Mac|Linux|Android|iOS/.exec(userAgent)?.[0] || "unknown";
        deviceId = `${platform}-${crypto.randomUUID().slice(0, 8)}`;
      }
      localStorage.setItem("deviceId", deviceId);
    } catch (error) {
      console.warn("Device identification failed, using fallback", error);
      deviceId = `device-${crypto.randomUUID().slice(0, 8)}`;
      localStorage.setItem("deviceId", deviceId);
    }
  }
})();

const authToken = localStorage.getItem("authToken");
const userEmail = localStorage.getItem("userEmail");
const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://batterysync-backend.onrender.com";

// Redirect to login if credentials are missing
if (!authToken || !userEmail) {
  console.log("No auth token or email found, redirecting to login");
  window.location.href = "/login.html";
}

let previousCharging = null;
// Declare WebSocket reconnection variables once at the top
let wsReconnectAttempts = 0;
let wsReconnectTimeout = null;

// Function to show browser notifications (and toast fallback)
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
  showToast(title, message);
}

// Function to show toast animation
function showToast(title, message) {
  try {
    const existingToast = document.querySelector(".notification-toast");
    if (existingToast) existingToast.remove();
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

// Function to handle authentication errors
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
        deviceId: deviceId,
        deviceName: navigator.platform,
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
    await updateBatteryStatus();
    const intervalId = setInterval(updateBatteryStatus, 5000);
    battery.addEventListener("chargingchange", updateBatteryStatus);
    battery.addEventListener("levelchange", updateBatteryStatus);
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

// Function to fetch battery status from backend API
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
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
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
    console.log("Battery status response:", data);
    // Handle both formats: API format and WebSocket format
    if ("percentage" in data && "charging" in data) {
      updateBattery({ [userEmail]: data });
    } else if (data[userEmail]) {
      updateBattery(data);
    } else {
      console.error("Invalid battery data structure:", data);
    }
  } catch (error) {
    console.error("Error fetching battery status:", error);
    showToast("Error", "Failed to fetch battery status");
  }
}

// WebSocket connection function with reconnection logic
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
  console.log("Connecting WebSocket...");
  const ws = new WebSocket(
    `${wsURL}?token=${encodeURIComponent(authToken)}&email=${encodeURIComponent(
      userEmail
    )}`
  );
  ws.onopen = () => {
    console.log("WebSocket connected");
    wsReconnectAttempts = 0;
    if (wsReconnectTimeout) {
      clearTimeout(wsReconnectTimeout);
      wsReconnectTimeout = null;
    }
  };
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("WebSocket message received:", data);
      if (data.error === "unauthorized") {
        handleAuthError();
        return;
      }
      // Handle data in two possible formats
      let batteryData = null;
      if (data && typeof data === "object" && data[userEmail]) {
        batteryData = data[userEmail];
        console.log("Processing WebSocket format:", batteryData);
      } else if (
        data &&
        typeof data === "object" &&
        "percentage" in data &&
        "charging" in data
      ) {
        batteryData = data;
        console.log("Processing API format:", batteryData);
      } else {
        console.error("Invalid WebSocket data:", data);
        return;
      }
      if (
        batteryData &&
        batteryData.percentage !== undefined &&
        batteryData.charging !== undefined
      ) {
        updateBattery({ [userEmail]: batteryData });
      } else {
        console.error("Incomplete battery data:", batteryData);
      }
    } catch (error) {
      console.error("WebSocket message error:", error);
    }
  };
  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    wsReconnectAttempts++;
    showToast("Error", "WebSocket connection error. Retrying...");
  };
  ws.onclose = () => {
    console.log("WebSocket closed. Reconnecting...");
    wsReconnectAttempts++;
    if (!wsReconnectTimeout) {
      wsReconnectTimeout = setTimeout(() => {
        wsReconnectTimeout = null;
        connectWebSocket();
      }, 5000);
    }
  };
  return ws;
}

// Function to update battery UI elements
function updateBattery(data) {
  try {
    console.log("Raw battery data:", data);
    let batteryData;
    if (data && typeof data === "object" && data[userEmail]) {
      batteryData = data[userEmail];
      console.log("Processing WebSocket format:", batteryData);
    } else if (
      data &&
      typeof data === "object" &&
      "percentage" in data &&
      "charging" in data
    ) {
      batteryData = data;
      console.log("Processing API format:", batteryData);
    } else {
      console.error("Invalid battery data structure:", data);
      return;
    }
    if (!("percentage" in batteryData) || !("charging" in batteryData)) {
      console.error("Missing required battery properties:", batteryData);
      return;
    }
    const level = Number(batteryData.percentage);
    const charging = Boolean(batteryData.charging);
    if (isNaN(level)) {
      console.error("Invalid battery level:", level);
      return;
    }
    const normalizedLevel = Math.max(0, Math.min(100, level));
    console.log(
      `Updating battery UI: Level=${normalizedLevel}%, Charging=${charging}`
    );
    batteryLiquid.style.transition = "height 0.3s ease-in-out";
    batteryPercentage.innerHTML = normalizedLevel + "%";
    batteryLiquid.style.height = `${normalizedLevel}%`;
    if (normalizedLevel === 100) {
      batteryStatusElem.innerHTML = `Full battery <i class="ri-battery-2-fill green-color"></i>`;
      batteryLiquid.style.height = "103%";
    } else if (normalizedLevel <= 20 && !charging) {
      batteryStatusElem.innerHTML = `Low battery <i class="ri-plug-line animated-red"></i>`;
    } else if (charging) {
      batteryStatusElem.innerHTML = `Charging... <i class="ri-flashlight-line animated-green"></i>`;
    } else {
      batteryStatusElem.innerHTML = "";
    }
    batteryLiquid.classList.remove(
      "gradient-color-red",
      "gradient-color-orange",
      "gradient-color-yellow",
      "gradient-color-green"
    );
    if (normalizedLevel <= 20) {
      batteryLiquid.classList.add("gradient-color-red");
    } else if (normalizedLevel <= 40) {
      batteryLiquid.classList.add("gradient-color-orange");
    } else if (normalizedLevel <= 80) {
      batteryLiquid.classList.add("gradient-color-yellow");
    } else {
      batteryLiquid.classList.add("gradient-color-green");
    }
    if (previousCharging !== charging) {
      if (charging) {
        showNotification("Charger Connected", "Battery is now charging");
      } else if (previousCharging !== null) {
        showNotification(
          "Charger Disconnected",
          "Battery is on power save mode"
        );
      }
      previousCharging = charging;
    }
    if (normalizedLevel >= 90 && charging) {
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

// Initialize application when page loads
document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (!authToken || !userEmail) {
      handleAuthError();
      return;
    }
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
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
    const cleanup = await sendBatteryStatus();
    await fetchBatteryStatus();
    const ws = connectWebSocket();
    window.addEventListener("beforeunload", () => {
      cleanup?.();
      ws?.close();
    });
  } catch (error) {
    console.error("Initialization error:", error);
    showToast("Error", "Failed to initialize application");
  }
});
