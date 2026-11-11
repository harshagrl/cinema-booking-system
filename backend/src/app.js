
import express from "express";
import cors from "cors";
import helmet from "helmet";
import prisma from "./config/database.js";
const app = express();

app.use(helmet());

app.use(cors({
    origin: "http://localhost:5173"
}));

app.use(express.json());

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Cinema Booking API is running",
        timestamp: new Date().toISOString()
    });
});
app.get("/api/health/db", async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;

        res.status(200).json({
            success: true,
            message: "PostgreSQL connected successfully"
        });

    } catch (error) {
        res.status(503).json({
            success: false,
            message: "Database connection failed"
        });
    }
});

export default app;
