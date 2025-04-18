document.getElementById("generateRoomId").addEventListener("click", async (e) => {
  e.preventDefault();
  const password = document.getElementById("password").value;
  const userName = document.getElementById("userName").value;

  if (!password || !userName) {
    alert("Both fields required!");
    return;
  }

  try {
    // Get the server URL dynamically
    const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
      ? 'http://localhost:3000' 
      : `http://${window.location.hostname}:3000`;

    const response = await fetch(`${serverUrl}/create-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, userName }),
    });

    const data = await response.json();

    if (data.roomId) {
      document.getElementById("roomId").value = data.roomId; // show room ID in the field
    } else {
      alert(data.error || "Failed to create room");
    }
  } catch (err) {
    console.error("Room creation error:", err);
    alert("Error generating room. Try again.");
  }
});

document.getElementById("joinRoomForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const roomId = document.getElementById("roomId").value;
  const password = document.getElementById("password").value;
  const userName = document.getElementById("userName").value;

  try {
    const serverUrl =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "http://localhost:3000"
        : `http://${window.location.hostname}:3000`;

    // Try to join the room
    const joinResponse = await fetch(`${serverUrl}/join-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, password, userName }),
    });

    const data = await joinResponse.json();

    if (joinResponse.ok) {
      // Room exists and password is correct
      window.location.href = `/room.html?roomId=${roomId}&userName=${encodeURIComponent(userName)}`;
    } else {
      // Show specific error returned by server
      alert(data.error || "Failed to join room. Please check the room ID and password.");
    }
  } catch (err) {
    console.error("Error:", err);
    alert("An error occurred. Please try again.");
  }
});
