import type { Server } from "http";
import jwt from "jsonwebtoken";
import WebSocket, { WebSocketServer } from "ws";
import pool from "../config/database";

const connections = new Map<number, Set<WebSocket>>();

export const setupWebSocket = (server: Server) => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is not defined");
    }

    const wss = new WebSocketServer({
        noServer: true,
        maxPayload: 16 * 1024
    });

    server.on("upgrade", async (request, socket, head) => {
        socket.on("error", () => {
            // Handle network errors during the upgrade.
        });

        if (request.url !== "/ws") {
            socket.destroy();
            return;
        }

        const authHeader = request.headers.authorization;

        if (!authHeader?.startsWith("Bearer ")) {
            socket.end(
                "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n"
            );
            return;
        }

        let userId: number;
        let expiresAt: number;

        try {
            const token = authHeader.slice(7);
            const decoded = jwt.verify(token, secret);

            if (
                typeof decoded === "string" ||
                !Number.isInteger(decoded.id) ||
                decoded.id <= 0 ||
                typeof decoded.exp !== "number"
            ) {
                throw new Error("Invalid token payload");
            }

            userId = decoded.id;
            expiresAt = decoded.exp;
        } catch {
            socket.end(
                "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n"
            );
            return;
        }

        try {
            const result = await pool.query(
                "SELECT id FROM users WHERE id = $1",
                [userId]
            );

            if (
                result.rows.length === 0 ||
                expiresAt * 1000 <= Date.now()
            ) {
                socket.end(
                    "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n"
                );
                return;
            }
        } catch (error) {
            console.error("WebSocket authentication error:", error);

            socket.end(
                "HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n"
            );
            return;
        }

        if (socket.destroyed) {
            return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
            let userConnections = connections.get(userId);

            if (!userConnections) {
                userConnections = new Set<WebSocket>();
                connections.set(userId, userConnections);
            }

            userConnections.add(ws);

            // Require a fresh connection when the JWT expires.
            const expiryTimer = setTimeout(() => {
                ws.close(1008, "Token expired; log in and reconnect");
            }, Math.min(
                expiresAt * 1000 - Date.now(),
                2_147_483_647
            ));

            ws.on("close", () => {
                clearTimeout(expiryTimer);
                userConnections.delete(ws);

                if (userConnections.size === 0) {
                    connections.delete(userId);
                }
            });

            ws.on("error", (error) => {
                console.error("WebSocket connection error:", error);
            });

            ws.send(JSON.stringify({
                event: "connected",
                user_id: userId,
                message: "Live notifications connected"
            }));
        });
    });

    return wss;
};

export const sendUserNotification = (
    userId: number,
    notification: unknown
) => {
    const userConnections = connections.get(userId);

    if (!userConnections) {
        return;
    }

    const message = JSON.stringify({
        event: "notification",
        notification
    });

    for (const ws of userConnections) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message, (error) => {
                if (error) {
                    console.error("Notification delivery error:", error);
                }
            });
        }
    }
};