import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import projectRoutes from "./routes/projects";
import commentRoutes from "./routes/comments";
import submissionRoutes from "./routes/submissions";
import { authenticate } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";


dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/comments", commentRoutes);


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
app.use("/api/projects", projectRoutes);
app.use("/api/submissions", submissionRoutes);

app.use((_req, res) => {
    res.status(404).json({
        message: "Route not found"
    });
});

app.use(errorHandler);


export default app;