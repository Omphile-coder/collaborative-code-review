import app from "./app";
import pool from "./config/database";
import { createServer } from "http";
import { setupWebSocket } from "./services/websocket";

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        await pool.query("SELECT NOW()");

        console.log("Database connection successful");

        const server = createServer(app);

setupWebSocket(server);

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
});
    } catch (error) {
        console.error("Failed to connect to PostgreSQL:", error);
        process.exit(1);
    }
};

startServer();