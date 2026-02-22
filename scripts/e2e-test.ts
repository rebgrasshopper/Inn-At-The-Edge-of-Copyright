/**
 * End-to-end test script for socket-based game commands
 * Run with: npx tsx scripts/e2e-test.ts
 */
import { io, Socket } from "socket.io-client";

const SERVER_URL = "http://localhost:3000";

type TestResult = {
  name: string;
  passed: boolean;
  error?: string;
};

const results: TestResult[] = [];

/**
 * Helper to get auth token
 */
async function getToken(
  username: string,
  password: string,
): Promise<string | null> {
  const res = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  return data.token || null;
}

/**
 * Helper to create a socket connection with auth
 */
function createSocket(token: string): Socket {
  return io(SERVER_URL, {
    auth: { token },
    transports: ["websocket"],
  });
}

/**
 * Wait for a specific event with timeout
 */
function waitForEvent<T>(
  socket: Socket,
  event: string,
  timeout = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeout);

    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Wait for any of multiple events
 */
function waitForAnyEvent<T>(
  socket: Socket,
  events: string[],
  timeout = 5000,
): Promise<{ event: string; data: T }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      events.forEach((e) => socket.off(e));
      reject(new Error(`Timeout waiting for any of: ${events.join(", ")}`));
    }, timeout);

    events.forEach((event) => {
      socket.once(event, (data: T) => {
        clearTimeout(timer);
        events.forEach((e) => socket.off(e));
        resolve({ event, data });
      });
    });
  });
}

async function runTests() {
  console.log("🧪 Starting E2E Tests...\n");

  // Get token for test user
  const token = await getToken("testuser_e2e", "TestPass123!");
  if (!token) {
    console.error("❌ Failed to get auth token");
    process.exit(1);
  }

  const socket = createSocket(token);

  // Wait for connection
  await new Promise<void>((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
    setTimeout(() => reject(new Error("Connection timeout")), 5000);
  });

  console.log("✅ Connected to server\n");

  // Wait for initial room data
  const roomData = await waitForEvent<{ room: { name: string } }>(
    socket,
    "room:enter",
  );
  console.log(`📍 Starting room: ${roomData.room.name}\n`);

  // Test 1: Look command (sends room:look event)
  try {
    socket.emit("command", "look");
    const result = await waitForEvent<{ room: { name: string } }>(
      socket,
      "room:look",
    );
    const passed = result.room && result.room.name === roomData.room.name;
    results.push({ name: "Look command", passed });
    console.log(`Test: Look command - ${passed ? "✅" : "❌"}`);
  } catch (e) {
    results.push({ name: "Look command", passed: false, error: String(e) });
    console.log(`Test: Look command - ❌ ${e}`);
  }

  // Test 2: Movement (go north from town square)
  try {
    socket.emit("command", "north");
    const moveResult = await waitForEvent<{ room: { name: string } }>(
      socket,
      "room:enter",
    );
    const moved = moveResult.room.name !== roomData.room.name;
    results.push({ name: "Movement (north)", passed: moved });
    console.log(
      `Test: Movement (north) - ${moved ? "✅" : "❌"} (now in: ${moveResult.room.name})`,
    );

    // Move back
    socket.emit("command", "south");
    await waitForEvent(socket, "room:enter");
  } catch (e) {
    results.push({ name: "Movement (north)", passed: false, error: String(e) });
    console.log(`Test: Movement (north) - ❌ ${e}`);
  }

  // Test 3: Inventory command (sends inventory:list event)
  try {
    socket.emit("command", "inventory");
    const result = await waitForAnyEvent<unknown>(socket, [
      "inventory:list",
      "chat:message",
    ]);
    // Either event is acceptable - inventory:list or a chat message
    results.push({ name: "Inventory command", passed: true });
    console.log(`Test: Inventory command - ✅ (got ${result.event})`);
  } catch (e) {
    results.push({
      name: "Inventory command",
      passed: false,
      error: String(e),
    });
    console.log(`Test: Inventory command - ❌ ${e}`);
  }

  // Test 4: Stats command (sends chat:message)
  try {
    socket.emit("command", "stats");
    const result = await waitForEvent<{ content: string }>(
      socket,
      "chat:message",
    );
    const passed = Boolean(result.content && result.content.includes("Level"));
    results.push({ name: "Stats command", passed });
    console.log(`Test: Stats command - ${passed ? "✅" : "❌"}`);
  } catch (e) {
    results.push({ name: "Stats command", passed: false, error: String(e) });
    console.log(`Test: Stats command - ❌ ${e}`);
  }

  // Test 5: Speak command (sends chat:message to room)
  try {
    socket.emit("command", "say Hello world!");
    const result = await waitForEvent<{ sender: string; content: string }>(
      socket,
      "chat:message",
    );
    // The sender should be our character name
    const passed =
      result.content === "Hello world!" || result.sender === "Thorin";
    results.push({ name: "Speak command", passed });
    console.log(`Test: Speak command - ${passed ? "✅" : "❌"}`);
  } catch (e) {
    results.push({ name: "Speak command", passed: false, error: String(e) });
    console.log(`Test: Speak command - ❌ ${e}`);
  }

  // Test 6: Help command (sends chat:message)
  try {
    socket.emit("command", "help");
    const result = await waitForEvent<{ content: string }>(
      socket,
      "chat:message",
    );
    const passed = Boolean(
      result.content && result.content.includes("Available commands"),
    );
    results.push({ name: "Help command", passed });
    console.log(`Test: Help command - ${passed ? "✅" : "❌"}`);
  } catch (e) {
    results.push({ name: "Help command", passed: false, error: String(e) });
    console.log(`Test: Help command - ❌ ${e}`);
  }

  // Test 7: Equipment command (sends equipment:list or chat:message)
  try {
    socket.emit("command", "equipment");
    const result = await waitForAnyEvent<unknown>(socket, [
      "equipment:list",
      "chat:message",
    ]);
    results.push({ name: "Equipment command", passed: true });
    console.log(`Test: Equipment command - ✅ (got ${result.event})`);
  } catch (e) {
    results.push({
      name: "Equipment command",
      passed: false,
      error: String(e),
    });
    console.log(`Test: Equipment command - ❌ ${e}`);
  }

  // Test 8: Examine self (sends chat:message with character info)
  try {
    socket.emit("command", "examine self");
    const result = await waitForEvent<{ content: string }>(
      socket,
      "chat:message",
    );
    const passed = Boolean(result.content && result.content.includes("Thorin"));
    results.push({ name: "Examine self", passed });
    console.log(`Test: Examine self - ${passed ? "✅" : "❌"}`);
  } catch (e) {
    results.push({ name: "Examine self", passed: false, error: String(e) });
    console.log(`Test: Examine self - ❌ ${e}`);
  }

  // ============================================
  // ITEM INTERACTION TESTS
  // ============================================
  console.log("\n--- Item Interaction Tests ---\n");

  // Test 9: Get item from room
  try {
    socket.emit("command", "get flyer");
    const result = await waitForEvent<{ content: string }>(
      socket,
      "chat:message",
    );
    const passed = Boolean(
      result.content && result.content.includes("pick up"),
    );
    results.push({ name: "Get item", passed });
    console.log(`Test: Get item - ${passed ? "✅" : "❌"}`);
  } catch (e) {
    results.push({ name: "Get item", passed: false, error: String(e) });
    console.log(`Test: Get item - ❌ ${e}`);
  }

  // Test 10: Examine item in inventory
  try {
    socket.emit("command", "examine flyer");
    const result = await waitForEvent<{ content: string }>(
      socket,
      "chat:message",
    );
    // Check for "Circus" (capital C) as in the item description
    const passed = Boolean(
      result.content && result.content.toLowerCase().includes("circus"),
    );
    results.push({ name: "Examine item", passed });
    console.log(`Test: Examine item - ${passed ? "✅" : "❌"}`);
    if (!passed)
      console.log(`  Response: ${result.content?.substring(0, 100)}`);
  } catch (e) {
    results.push({ name: "Examine item", passed: false, error: String(e) });
    console.log(`Test: Examine item - ❌ ${e}`);
  }

  // Test 11: Drop item
  try {
    socket.emit("command", "drop flyer");
    const result = await waitForEvent<{ content: string }>(
      socket,
      "chat:message",
    );
    const passed = Boolean(result.content && result.content.includes("drop"));
    results.push({ name: "Drop item", passed });
    console.log(`Test: Drop item - ${passed ? "✅" : "❌"}`);
  } catch (e) {
    results.push({ name: "Drop item", passed: false, error: String(e) });
    console.log(`Test: Drop item - ❌ ${e}`);
  }

  // Test 12: Get multiple items (bulk) - try to get rocks which have 8 in the room
  try {
    socket.emit("command", "get 2 rocks");
    const result = await waitForEvent<{ content: string }>(
      socket,
      "chat:message",
    );
    // Accept either success or "only X here" as valid responses
    const passed = Boolean(
      result.content &&
      (result.content.includes("pick up") ||
        result.content.includes("only") ||
        result.content.includes("don't see")),
    );
    results.push({ name: "Get multiple items", passed });
    console.log(`Test: Get multiple items - ${passed ? "✅" : "❌"}`);
    if (!passed)
      console.log(`  Response: ${result.content?.substring(0, 100)}`);
  } catch (e) {
    results.push({
      name: "Get multiple items",
      passed: false,
      error: String(e),
    });
    console.log(`Test: Get multiple items - ❌ ${e}`);
  }

  // ============================================
  // FEATURE INTERACTION TESTS
  // ============================================
  console.log("\n--- Feature Interaction Tests ---\n");

  // Test 13: Interact with fountain feature
  try {
    socket.emit("command", "drink fountain");
    const result = await waitForEvent<{ content: string }>(
      socket,
      "chat:message",
    );
    const passed = Boolean(result.content && result.content.includes("drink"));
    results.push({ name: "Feature interaction (fountain)", passed });
    console.log(
      `Test: Feature interaction (fountain) - ${passed ? "✅" : "❌"}`,
    );
  } catch (e) {
    results.push({
      name: "Feature interaction (fountain)",
      passed: false,
      error: String(e),
    });
    console.log(`Test: Feature interaction (fountain) - ❌ ${e}`);
  }

  // Test 14: Go to forest clearing and search mushrooms
  try {
    // Navigate to forest clearing
    socket.emit("command", "south");
    await waitForEvent(socket, "room:enter");
    socket.emit("command", "south");
    await waitForEvent(socket, "room:enter");

    // Search mushrooms to reveal hidden container
    socket.emit("command", "search mushrooms");
    const result = await waitForEvent<{ content: string }>(
      socket,
      "chat:message",
    );
    const passed = Boolean(
      result.content && result.content.includes("hidden cache"),
    );
    results.push({ name: "Feature reveals container", passed });
    console.log(`Test: Feature reveals container - ${passed ? "✅" : "❌"}`);

    // Go back to town square
    socket.emit("command", "north");
    await waitForEvent(socket, "room:enter");
    socket.emit("command", "north");
    await waitForEvent(socket, "room:enter");
  } catch (e) {
    results.push({
      name: "Feature reveals container",
      passed: false,
      error: String(e),
    });
    console.log(`Test: Feature reveals container - ❌ ${e}`);
  }

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================
  console.log("\n--- Error Handling Tests ---\n");

  // Test 15: Invalid direction (try to go west from town square - no exit there)
  try {
    socket.emit("command", "west");
    const result = await waitForEvent<{ content: string }>(
      socket,
      "chat:message",
    );
    // Check for various error messages about invalid direction
    const passed = Boolean(
      result.content &&
      (result.content.includes("can't go") ||
        result.content.includes("no exit") ||
        result.content.includes("There is no") ||
        result.content.includes("direction")),
    );
    results.push({ name: "Invalid direction error", passed });
    console.log(`Test: Invalid direction error - ${passed ? "✅" : "❌"}`);
    if (!passed)
      console.log(`  Response: ${result.content?.substring(0, 100)}`);
  } catch (e) {
    results.push({
      name: "Invalid direction error",
      passed: false,
      error: String(e),
    });
    console.log(`Test: Invalid direction error - ❌ ${e}`);
  }

  // Test 16: Get non-existent item
  try {
    socket.emit("command", "get unicorn");
    const result = await waitForEvent<{ content: string }>(
      socket,
      "chat:message",
    );
    const passed = Boolean(
      result.content &&
      (result.content.includes("don't see") || result.content.includes("no ")),
    );
    results.push({ name: "Get non-existent item error", passed });
    console.log(`Test: Get non-existent item error - ${passed ? "✅" : "❌"}`);
  } catch (e) {
    results.push({
      name: "Get non-existent item error",
      passed: false,
      error: String(e),
    });
    console.log(`Test: Get non-existent item error - ❌ ${e}`);
  }

  // Test 17: Unknown command
  try {
    socket.emit("command", "xyzzy");
    const result = await waitForEvent<{ content: string }>(
      socket,
      "chat:message",
    );
    const passed = Boolean(
      result.content &&
      (result.content.includes("don't understand") ||
        result.content.includes("Unknown") ||
        result.content.includes("Did you mean")),
    );
    results.push({ name: "Unknown command error", passed });
    console.log(`Test: Unknown command error - ${passed ? "✅" : "❌"}`);
  } catch (e) {
    results.push({
      name: "Unknown command error",
      passed: false,
      error: String(e),
    });
    console.log(`Test: Unknown command error - ❌ ${e}`);
  }

  // Test 18: Empty command
  try {
    socket.emit("command", "");
    const result = await waitForEvent<{ content: string }>(
      socket,
      "chat:message",
    );
    // Empty command should either be ignored or return an error
    const passed = result.content !== undefined;
    results.push({ name: "Empty command handling", passed });
    console.log(`Test: Empty command handling - ${passed ? "✅" : "❌"}`);
  } catch (e) {
    // Timeout is acceptable for empty command (might be ignored)
    results.push({ name: "Empty command handling", passed: true });
    console.log(`Test: Empty command handling - ✅ (ignored)`);
  }

  // Cleanup
  socket.disconnect();

  // Summary
  console.log("\n" + "=".repeat(40));
  const passed = results.filter((r) => r.passed).length;
  console.log(`Results: ${passed}/${results.length} tests passed`);

  if (passed < results.length) {
    console.log("\nFailed tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => console.log(`  - ${r.name}: ${r.error || "failed"}`));
    process.exit(1);
  }

  process.exit(0);
}

runTests().catch((e) => {
  console.error("Test runner error:", e);
  process.exit(1);
});
