import { Request, Response } from "express";
import pool from "../config/database";

export const addComment = async (
    req: Request,
    res: Response
) => {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    if (req.user.role !== "reviewer") {
        return res.status(403).json({
            message: "Only reviewers can add comments"
        });
    }

    try {
        const submissionId = Number(req.params.id);
        const { content, line_number } = req.body;

        const submissionResult = await pool.query(
            `SELECT id, project_id, code
             FROM submissions
             WHERE id = $1`,
            [submissionId]
        );

        if (submissionResult.rows.length === 0) {
            return res.status(404).json({
                message: "Submission not found"
            });
        }

        const submission = submissionResult.rows[0];

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
            [submission.project_id, req.user.id]
        );

        if (accessResult.rows.length === 0) {
            return res.status(403).json({
                message: "You do not have access to this submission"
            });
        }

        // null means a general comment.
        const lineNumber =
            line_number == null ? null : Number(line_number);

        if (lineNumber !== null) {
            const lineCount = submission.code.split(
                /\r\n|\n|\r/
            ).length;

            if (
                !Number.isInteger(lineNumber) ||
                lineNumber < 1 ||
                lineNumber > lineCount
            ) {
                return res.status(400).json({
                    message:
                        `Line number must be between 1 and ${lineCount}`
                });
            }
        }

        const result = await pool.query(
            `INSERT INTO comments (
                submission_id,
                user_id,
                content,
                line_number
             )
             VALUES ($1, $2, $3, $4)
             RETURNING id, submission_id, user_id, content,
                       line_number, created_at, updated_at`,
            [
                submissionId,
                req.user.id,
                content,
                lineNumber
            ]
        );

        return res.status(201).json({
            message: "Comment added successfully",
            comment: result.rows[0]
        });
    } catch (error) {
        console.error("Add comment error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};