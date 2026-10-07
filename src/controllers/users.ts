import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import pool from "../config/database";

export const getUserById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    try {
        const result = await pool.query(
            `SELECT id, name, email, role, profile_picture,
                    created_at, updated_at
             FROM users
             WHERE id = $1`,
            [Number(req.params.id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            user: result.rows[0]
        });
    } catch (error) {
        return next(error);
    }
};

export const updateUser = async (
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
            message: "You can only update your own profile"
        });
    }

    try {
        const { name, email, password, profile_picture } = req.body;

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE id = $1",
            [userId]
        );

        if (existingUser.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const passwordHash =
            password === undefined
                ? null
                : await bcrypt.hash(password, 10);

        const result = await pool.query(
            `UPDATE users
             SET name = COALESCE($1, name),
                 email = COALESCE($2, email),
                 password_hash = COALESCE($3, password_hash),
                 profile_picture = COALESCE($4, profile_picture),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5
             RETURNING id, name, email, role, profile_picture,
                       created_at, updated_at`,
            [
                name ?? null,
                email ?? null,
                passwordHash,
                profile_picture ?? null,
                userId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            message: "User updated successfully",
            user: result.rows[0]
        });
    } catch (error) {
        return next(error);
    }
};

export const deleteUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    if (req.user.role !== "reviewer") {
        return res.status(403).json({
            message: "Only reviewers can delete users"
        });
    }

    try {
        const result = await pool.query(
            `DELETE FROM users
             WHERE id = $1
             RETURNING id`,
            [Number(req.params.id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            message: "User deleted successfully"
        });
    } catch (error) {
        return next(error);
    }
};