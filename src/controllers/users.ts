import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import pool from "../config/database";

export const getUserById = async(req: Request, res: Response) => { 
    try {
    const userId = Number(req.params.id);

    const result = await pool.query(
        `SELECT id, name, email, role, profile_picture, created_at, updated_at
         FROM users
         WHERE id = $1`,
        [userId]
        );
    
         if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            user: result.rows[0]
        });
    }catch(error) {
        console.error("Error fetching user:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }

}

export const updateUser = async (
    req: Request,
    res: Response
) => {
    try {
        const userId = Number(req.params.id);

        const {
            name,
            email,
            password,
            profile_picture
        } = req.body;

        const existingUser = await pool.query(
            `SELECT id
             FROM users
             WHERE id = $1`,
            [userId]
        );

        if (existingUser.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        let passwordHash: string | null = null;

        if (password) {
            passwordHash = await bcrypt.hash(password, 10);
        }

        const result = await pool.query(
            `UPDATE users
             SET
                name = COALESCE($1, name),
                email = COALESCE($2, email),
                password_hash = COALESCE($3, password_hash),
                profile_picture = COALESCE($4, profile_picture),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $5
             RETURNING id, name, email, role, profile_picture, created_at, updated_at`,
            [
                name ?? null,
                email ?? null,
                passwordHash,
                profile_picture ?? null,
                userId
            ]
        );

        return res.status(200).json({
            message: "User updated successfully",
            user: result.rows[0]
        });
    } catch (error) {
        console.error("Update user error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

export const deleteUser = async (
    req: Request,
    res: Response
) => {
    try {
        const userId = Number(req.params.id);

        const result = await pool.query(
            `DELETE FROM users
             WHERE id = $1
             RETURNING id`,
            [userId]
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
        console.error("Delete user error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};