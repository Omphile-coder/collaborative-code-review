import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import { authenticate } from "./middleware/auth";


dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());


app.get("/", (req, res) => {
    res.json({
        message: "Collaborative Code Review Platform API ",
        status: "running"
    });

});

app.get("/api/protected", authenticate, (req, res) => {
    res.json({
        message: "You accessed a protected route",
        user: req.user
    });
});

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

export default app;