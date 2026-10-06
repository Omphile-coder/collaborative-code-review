import { Request, Response } from "express";
import pool from "../config/database";

export const createSubmission = async (
    req: Request,
    res: Response
) => {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    try {
        const {
            project_id,
            title,
            code,
            language
        } = req.body;

        // Check that the project exists
        const projectResult = await pool.query(
            `SELECT id
             FROM projects
             WHERE id = $1`,
            [project_id]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        // Check that the user has access to the project
        const accessResult = await pool.query(
            `SELECT 1
             FROM projects p
             WHERE p.id = $1
               AND (
                    p.created_by = $2
                    OR EXISTS (
                        SELECT 1
                        FROM project_members pm
                        WHERE pm.project_id = p.id
                          AND pm.user_id = $2
                    )
               )`,
            [project_id, req.user.id]
        );

        if (accessResult.rows.length === 0) {
            return res.status(403).json({
                message: "You do not have access to this project"
            });
        }

        // Create the submission
        const result = await pool.query(
            `INSERT INTO submissions (
                project_id,
                submitted_by,
                title,
                code,
                language
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING
                id,
                project_id,
                submitted_by,
                title,
                code,
                language,
                status,
                created_at,
                updated_at`,
            [
                project_id,
                req.user.id,
                title,
                code,
                language ?? null
            ]
        );

        return res.status(201).json({
            message: "Submission created successfully",
            submission: result.rows[0]
        });

    } catch (error) {
        console.error("Create submission error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};