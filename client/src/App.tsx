/**
 * Main application component with context providers.
 */

import { GameProvider, SocketProvider, AuthProvider, useAuth } from "./context";
import { Console } from "./components";
import "./App.css";

/**
 * Inner app component that has access to auth context.
 * Passes token to SocketProvider for authenticated connections.
 */
function AppContent() {
  const { token, authState } = useAuth();

  // Only connect socket when fully authenticated (has character)
  const socketToken = authState === "authenticated" ? token : null;

  return (
    <SocketProvider token={socketToken}>
      <Console />
    </SocketProvider>
  );
}

/**
 * Root application component.
 * Wraps the app in AuthProvider and GameProvider contexts.
 * @returns Application component tree
 */
function App() {
  return (
    <AuthProvider>
      <GameProvider>
        <AppContent />
      </GameProvider>
    </AuthProvider>
  );
}

export default App;
