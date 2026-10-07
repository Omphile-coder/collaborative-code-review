import { Request, Response, NextFunction } from "express";
import pool from "../config/database";

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

export const createSubmission = async (
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
        const { project_id, title, code, language } = req.body;

        const projectResult = await pool.query(
            "SELECT id FROM projects WHERE id = $1",
            [project_id]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        const accessResult = await pool.query(
            projectAccessSql,
            [project_id, req.user.id]
        );

        if (accessResult.rows.length === 0) {
            return res.status(403).json({
                message: "You do not have access to this project"
            });
        }

        const result = await pool.query(
            `INSERT INTO submissions (
                project_id, submitted_by, title, code, language
             )
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, project_id, submitted_by, title,
                       code, language, status, created_at, updated_at`,
            [project_id, req.user.id, title, code, language ?? null]
        );

        return res.status(201).json({
            message: "Submission created successfully",
            submission: result.rows[0]
        });
    } catch (error) {
        return next(error);
    }
};

export const getProjectSubmissions = async (
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
        const projectId = Number(req.params.id);

        const projectResult = await pool.query(
            "SELECT id, name FROM projects WHERE id = $1",
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        const accessResult = await pool.query(
            projectAccessSql,
            [projectId, req.user.id]
        );

        if (accessResult.rows.length === 0) {
            return res.status(403).json({
                message: "You do not have access to this project"
            });
        }

        const result = await pool.query(
            `SELECT s.id, s.project_id, s.submitted_by,
                    u.name AS submitter_name,
                    u.email AS submitter_email,
                    s.title, s.code, s.language, s.status,
                    s.created_at, s.updated_at
             FROM submissions s
             JOIN users u ON u.id = s.submitted_by
             WHERE s.project_id = $1
             ORDER BY s.created_at DESC, s.id DESC`,
            [projectId]
        );

        return res.status(200).json({
            project: projectResult.rows[0],
            submissions: result.rows
        });
    } catch (error) {
        return next(error);
    }
};

export const getSubmissionById = async (
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
            `SELECT s.id, s.project_id,
                    p.name AS project_name,
                    s.submitted_by,
                    u.name AS submitter_name,
                    s.title, s.code, s.language, s.status,
                    s.created_at, s.updated_at
             FROM submissions s
             JOIN projects p ON p.id = s.project_id
             JOIN users u ON u.id = s.submitted_by
             WHERE s.id = $1`,
            [Number(req.params.id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Submission not found"
            });
        }

        const submission = result.rows[0];

        const accessResult = await pool.query(
            projectAccessSql,
            [submission.project_id, req.user.id]
        );

        if (accessResult.rows.length === 0) {
            return res.status(403).json({
                message: "You do not have access to this submission"
            });
        }

        return res.status(200).json({ submission });
    } catch (error) {
        return next(error);
    }
};

export const updateSubmissionStatus = async (
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
            message: "Only reviewers can update submission status"
        });
    }

    try {
        const submissionId = Number(req.params.id);
        const { status } = req.body;

        if (!["pending", "in_review"].includes(status)) {
            return res.status(400).json({
                message:
                    "Use the review endpoints to approve or request changes"
            });
        }

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
            `UPDATE submissions
             SET status = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING id, project_id, submitted_by, title,
                       code, language, status, created_at, updated_at`,
            [status, submissionId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Submission not found"
            });
        }

        return res.status(200).json({
            message: "Submission status updated successfully",
            submission: result.rows[0]
        });
    } catch (error) {
        return next(error);
    }
};

export const deleteSubmission = async (
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
            `SELECT s.id, s.submitted_by, p.created_by
             FROM submissions s
             JOIN projects p ON p.id = s.project_id
             WHERE s.id = $1`,
            [submissionId]
        );

        if (submissionResult.rows.length === 0) {
            return res.status(404).json({
                message: "Submission not found"
            });
        }

        const submission = submissionResult.rows[0];

        const isAuthor = submission.submitted_by === req.user.id;
        const isProjectCreator = submission.created_by === req.user.id;

        if (!isAuthor && !isProjectCreator) {
            return res.status(403).json({
                message:
                    "Only the submission author or project creator can delete this submission"
            });
        }

        const result = await pool.query(
            "DELETE FROM submissions WHERE id = $1 RETURNING id",
            [submissionId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Submission not found"
            });
        }

        return res.status(200).json({
            message: "Submission deleted successfully"
        });
    } catch (error) {
        return next(error);
    }
};