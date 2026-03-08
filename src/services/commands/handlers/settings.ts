/**
 * Settings command handlers.
 */

import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { users, type UserPreferences } from "../../../db/schema.js";
import { clearPrefsCache } from "../../../socket/handlers.js";
import type { CommandContext, CommandResult } from "../../../types/command.js";

/** Valid toggle settings and their display names */
const TOGGLE_SETTINGS: Record<
  string,
  { key: keyof UserPreferences; name: string }
> = {
  rolls: { key: "showRolls", name: "dice rolls" },
  dice: { key: "showRolls", name: "dice rolls" },
  colors: { key: "showColors", name: "enhanced colors" },
};

/**
 * Handle toggle command - toggle boolean user preferences
 * @param args - Command arguments (setting name)
 * @param context - Command context with player info
 * @returns Command result with success/failure message
 */
export async function handleToggle(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const settingName = args[0]?.toLowerCase();

  if (!settingName) {
    const availableSettings = Object.keys(TOGGLE_SETTINGS).join(", ");
    return {
      success: false,
      message: `Toggle what? Available settings: ${availableSettings}`,
    };
  }

  const setting = TOGGLE_SETTINGS[settingName];
  if (!setting) {
    const availableSettings = Object.keys(TOGGLE_SETTINGS).join(", ");
    return {
      success: false,
      message: `Unknown setting "${settingName}". Available: ${availableSettings}`,
    };
  }

  // Get the user record
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, context.player.userId))
    .get();

  if (!user) {
    return { success: false, message: "User not found." };
  }

  // Toggle the setting
  const currentPrefs = user.preferences || {};
  const currentValue = currentPrefs[setting.key] ?? false;
  const newValue = !currentValue;

  const newPrefs: UserPreferences = {
    ...currentPrefs,
    [setting.key]: newValue,
  };

  await db
    .update(users)
    .set({ preferences: newPrefs })
    .where(eq(users.id, user.id));

  // Clear the preferences cache so new setting takes effect immediately
  clearPrefsCache(user.id);

  const status = newValue ? "ON" : "OFF";
  return {
    success: true,
    message: `Showing ${setting.name}: ${status}`,
  };
}
