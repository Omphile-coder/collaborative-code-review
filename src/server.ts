import app from "./app";
import pool from "./config/database";

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        await pool.query("SELECT NOW()");

        console.log("Database connection successful");

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to connect to PostgreSQL:", error);
        process.exit(1);
    }
};

startServer();