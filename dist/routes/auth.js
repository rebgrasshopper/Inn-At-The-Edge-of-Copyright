import { Router } from "express";
import * as AuthService from "../services/AuthService.js";
const router = Router();
/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post("/register", async (req, res) => {
    const { username, password } = req.body;
    // Validate input
    if (!username || typeof username !== "string") {
        res.status(400).json({ error: "Username is required" });
        return;
    }
    if (!password || typeof password !== "string") {
        res.status(400).json({ error: "Password is required" });
        return;
    }
    if (username.length < 3) {
        res.status(400).json({ error: "Username must be at least 3 characters" });
        return;
    }
    if (password.length < 6) {
        res.status(400).json({ error: "Password must be at least 6 characters" });
        return;
    }
    const result = await AuthService.register(username, password);
    if (result.success) {
        res.status(201).json({
            success: true,
            token: result.token,
        });
    }
    else {
        // Username already exists returns 409 Conflict
        const status = result.error === "Username already exists" ? 409 : 400;
        res.status(status).json({
            success: false,
            error: result.error,
        });
    }
});
/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    // Validate input
    if (!username || typeof username !== "string") {
        res.status(400).json({ error: "Username is required" });
        return;
    }
    if (!password || typeof password !== "string") {
        res.status(400).json({ error: "Password is required" });
        return;
    }
    const result = await AuthService.login(username, password);
    if (result.success) {
        res.json({
            success: true,
            token: result.token,
            player: result.player,
        });
    }
    else {
        // Invalid credentials returns 401 Unauthorized
        res.status(401).json({
            success: false,
            error: result.error,
        });
    }
});
export default router;
//# sourceMappingURL=auth.js.map