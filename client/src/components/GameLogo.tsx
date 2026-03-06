/**
 * Game logo component displaying ASCII art title.
 * Scales down on smaller screens to remain readable.
 */

import "./GameLogo.css";

/**
 * Full ASCII art logo for the game title (shown in chat/terminal).
 */
export const GAME_LOGO_ASCII = `
 ██████╗ ██╗    ██╗██████╗ 
 ██╔══██╗██║    ██║██╔══██╗
 ██████╔╝██║ █╗ ██║██║  ██║
 ██╔═══╝ ██║███╗██║██║  ██║
 ██║     ╚███╔███╔╝██████╔╝
 ╚═╝      ╚══╝╚══╝ ╚═════╝ 
`;

/**
 * Subtitle showing the expanded name with terminal-style path.
 */
export const GAME_SUBTITLE = "> pwd\n/Pixelless/Word/Dungeon";

/**
 * Compact header logo component for the page header.
 * Shows a slim single-line version of the game name.
 * @returns Compact logo component
 */
export function GameLogo() {
  return (
    <div className="game-logo-header">
      <span className="game-logo-prompt">&gt;</span>
      <span className="game-logo-text">pwd</span>
    </div>
  );
}
