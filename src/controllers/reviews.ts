import { Request, Response } from "express";
import { PoolClient } from "pg";
import pool from "../config/database";

export const approveSubmission = async (
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
            message: "Only reviewers can approve submissions"
        });
    }

    let client: PoolClient | undefined;
    let transactionStarted = false;

    try {
        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        const submissionResult = await client.query(
            `SELECT id, project_id, status
             FROM submissions
             WHERE id = $1
             FOR UPDATE`,
            [Number(req.params.id)]
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
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(403).json({
                message: "You do not have access to this submission"
            });
        }

        if (submission.status === "approved") {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(409).json({
                message: "Submission is already approved"
            });
        }

        const reviewResult = await client.query(
            `INSERT INTO reviews (
                submission_id,
                reviewer_id,
                decision,
                feedback
             )
             VALUES ($1, $2, 'approved', $3)
             RETURNING id, submission_id, reviewer_id,
                       decision, feedback, created_at`,
            [
                submission.id,
                req.user.id,
                req.body.feedback ?? null
            ]
        );

        const updatedSubmission = await client.query(
            `UPDATE submissions
             SET status = 'approved',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING id, project_id, submitted_by, title,
                       status, created_at, updated_at`,
            [submission.id]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return res.status(200).json({
            message: "Submission approved successfully",
            submission: updatedSubmission.rows[0],
            review: reviewResult.rows[0]
        });
    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback error:", rollbackError);
            }
        }

        console.error("Approve submission error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    } finally {
        client?.release();
    }
};

export const requestSubmissionChanges = async (
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
            message: "Only reviewers can request changes"
        });
    }

    let client: PoolClient | undefined;
    let transactionStarted = false;

    try {
        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        const submissionResult = await client.query(
            `SELECT id, project_id
             FROM submissions
             WHERE id = $1
             FOR UPDATE`,
            [Number(req.params.id)]
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
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(403).json({
                message: "You do not have access to this submission"
            });
        }

        const reviewResult = await client.query(
            `INSERT INTO reviews (
                submission_id,
                reviewer_id,
                decision,
                feedback
             )
             VALUES ($1, $2, 'changes_requested', $3)
             RETURNING id, submission_id, reviewer_id,
                       decision, feedback, created_at`,
            [
                submission.id,
                req.user.id,
                req.body.feedback
            ]
        );

        const updatedSubmission = await client.query(
            `UPDATE submissions
             SET status = 'changes_requested',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING id, project_id, submitted_by, title,
                       status, created_at, updated_at`,
            [submission.id]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return res.status(200).json({
            message: "Changes requested successfully",
            submission: updatedSubmission.rows[0],
            review: reviewResult.rows[0]
        });
    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback error:", rollbackError);
            }
        }

        console.error("Request changes error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    } finally {
        client?.release();
    }
};

export const getSubmissionReviews = async (
    req: Request,
    res: Response
) => {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    try {
        const submissionId = Number(req.params.id);

        const submissionResult = await pool.query(
            `SELECT id, project_id, status
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

        const result = await pool.query(
            `SELECT
                r.id,
                r.submission_id,
                r.reviewer_id,
                u.name AS reviewer_name,
                r.decision,
                r.feedback,
                r.created_at
             FROM reviews r
             JOIN users u ON u.id = r.reviewer_id
             WHERE r.submission_id = $1
             ORDER BY r.created_at ASC, r.id ASC`,
            [submissionId]
        );

        return res.status(200).json({
            submission_id: submission.id,
            current_status: submission.status,
            reviews: result.rows
        });
    } catch (error) {
        console.error("Get submission reviews error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};