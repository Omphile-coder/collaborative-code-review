import { Request, Response, NextFunction } from "express";
import type { PoolClient } from "pg";
import pool from "../config/database";
import { createNotification } from "../services/notifications";
import { sendUserNotification } from "../services/websocket";

const projectAccessSql = `
    SELECT 1
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
      )
`;

export const addComment = async (
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
            message: "Only reviewers can add comments"
        });
    }

    let client: PoolClient | undefined;
    let transactionStarted = false;

    try {
        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        const submissionId = Number(req.params.id);
        const { content, line_number } = req.body;

        const submissionResult = await client.query(
            `SELECT id, project_id, submitted_by, code
             FROM submissions
             WHERE id = $1
             FOR UPDATE`,
            [submissionId]
        );

        if (submissionResult.rows.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(404).json({
                message: "Submission not found"
            });
        }

        const submission = submissionResult.rows[0];

        const accessResult = await client.query(
            projectAccessSql,
            [submission.project_id, req.user.id]
        );

        if (accessResult.rows.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(403).json({
                message: "You do not have access to this submission"
            });
        }

        const lineNumber =
            line_number == null ? null : Number(line_number);

        if (lineNumber !== null) {
            const lineCount = submission.code.split(/\r\n|\n|\r/).length;

            if (
                !Number.isInteger(lineNumber) ||
                lineNumber < 1 ||
                lineNumber > lineCount
            ) {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return res.status(400).json({
                    message:
                        `Line number must be between 1 and ${lineCount}`
                });
            }
        }

        const result = await client.query(
            `INSERT INTO comments (
                submission_id, user_id, content, line_number
             )
             VALUES ($1, $2, $3, $4)
             RETURNING id, submission_id, user_id, content,
                       line_number, created_at, updated_at`,
            [submission.id, req.user.id, content, lineNumber]
        );

        const notification = await createNotification(client, {
            userId: submission.submitted_by,
            actorId: req.user.id,
            submissionId: submission.id,
            type: "comment_added",
            message: "A reviewer commented on your submission."
        });

        await client.query("COMMIT");
        transactionStarted = false;

        if (notification) {
            try {
                sendUserNotification(notification.user_id, notification);
            } catch (deliveryError) {
                console.error(
                    "Live notification delivery failed:",
                    deliveryError
                );
            }
        }

        return res.status(201).json({
            message: "Comment added successfully",
            comment: result.rows[0]
        });
    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback error:", rollbackError);
            }
        }

        return next(error);
    } finally {
        client?.release();
    }
};

export const getSubmissionComments = async (
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
        const submissionId = Number(req.params.id);

        const submissionResult = await pool.query(
            "SELECT id, project_id FROM submissions WHERE id = $1",
            [submissionId]
        );

        if (submissionResult.rows.length === 0) {
            return res.status(404).json({
                message: "Submission not found"
            });
        }

        const submission = submissionResult.rows[0];

        const accessResult = await pool.query(
            projectAccessSql,
            [submission.project_id, req.user.id]
        );

        if (accessResult.rows.length === 0) {
            return res.status(403).json({
                message: "You do not have access to this submission"
            });
        }

        const result = await pool.query(
            `SELECT c.id, c.submission_id, c.user_id,
                    u.name AS author_name,
                    c.content, c.line_number,
                    c.created_at, c.updated_at
             FROM comments c
             JOIN users u ON u.id = c.user_id
             WHERE c.submission_id = $1
             ORDER BY c.created_at ASC, c.id ASC`,
            [submissionId]
        );

        return res.status(200).json({
            submission_id: submissionId,
            comments: result.rows
        });
    } catch (error) {
        return next(error);
    }
};

export const updateComment = async (
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
            message: "Only reviewers can update comments"
        });
    }

    try {
        const commentId = Number(req.params.id);
        const { content } = req.body;

        const commentResult = await pool.query(
            `SELECT c.id, c.user_id, s.project_id
             FROM comments c
             JOIN submissions s ON s.id = c.submission_id
             WHERE c.id = $1`,
            [commentId]
        );

        if (commentResult.rows.length === 0) {
            return res.status(404).json({
                message: "Comment not found"
            });
        }

        const comment = commentResult.rows[0];

        if (comment.user_id !== req.user.id) {
            return res.status(403).json({
                message: "You can only update your own comments"
            });
        }

        const accessResult = await pool.query(
            projectAccessSql,
            [comment.project_id, req.user.id]
        );

        if (accessResult.rows.length === 0) {
            return res.status(403).json({
                message: "You no longer have access to this project"
            });
        }

        const result = await pool.query(
            `UPDATE comments
             SET content = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND user_id = $3
             RETURNING id, submission_id, user_id, content,
                       line_number, created_at, updated_at`,
            [content, commentId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Comment not found"
            });
        }

        return res.status(200).json({
            message: "Comment updated successfully",
            comment: result.rows[0]
        });
    } catch (error) {
        return next(error);
    }
};

export const deleteComment = async (
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
            message: "Only reviewers can delete comments"
        });
    }

    try {
        const commentId = Number(req.params.id);

        const commentResult = await pool.query(
            `SELECT c.id, c.user_id, s.project_id
             FROM comments c
             JOIN submissions s ON s.id = c.submission_id
             WHERE c.id = $1`,
            [commentId]
        );

        if (commentResult.rows.length === 0) {
            return res.status(404).json({
                message: "Comment not found"
            });
        }

        const comment = commentResult.rows[0];

        if (comment.user_id !== req.user.id) {
            return res.status(403).json({
                message: "You can only delete your own comments"
            });
        }

        const accessResult = await pool.query(
            projectAccessSql,
            [comment.project_id, req.user.id]
        );

        if (accessResult.rows.length === 0) {
            return res.status(403).json({
                message: "You no longer have access to this project"
            });
        }

        const result = await pool.query(
            `DELETE FROM comments
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [commentId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Comment not found"
            });
        }

        return res.status(200).json({
            message: "Comment deleted successfully"
        });
    } catch (error) {
        return next(error);
    }
};