import type { Player } from "./player.js";
export type AuthResult = {
    success: boolean;
    token?: string;
    player?: Player;
    error?: string;
};
export type JWTPayload = {
    userId: string;
    username: string;
    iat?: number;
    exp?: number;
};
//# sourceMappingURL=auth.d.ts.map