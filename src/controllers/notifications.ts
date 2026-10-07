import { Request, Response, NextFunction } from "express";
import pool from "../config/database";

export const getUserNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    const userId = Number(req.params.id);

    if (req.user.id !== userId) {
        return res.status(403).json({
            message: "You can only view your own notifications"
        });
    }

    try {
        const userResult = await pool.query(
            "SELECT id FROM users WHERE id = $1",
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const result = await pool.query(
            `SELECT n.id, n.user_id, n.actor_id,
                    u.name AS actor_name,
                    n.submission_id, n.type, n.message,
                    n.is_read, n.created_at
             FROM notifications n
             LEFT JOIN users u ON u.id = n.actor_id
             WHERE n.user_id = $1
             ORDER BY n.created_at DESC, n.id DESC`,
            [userId]
        );

        return res.status(200).json({
            user_id: userId,
            notifications: result.rows
        });
    } catch (error) {
        return next(error);
    }
};