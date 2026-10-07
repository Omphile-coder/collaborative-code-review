import { Request, Response, NextFunction } from "express";
import pool from "../config/database";

export const getProjectStats = async (
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
            [projectId, req.user.id]
        );

        if (accessResult.rows.length === 0) {
            return res.status(403).json({
                message: "You do not have access to this project"
            });
        }

        const [
            totalsResult,
            timingResult,
            reviewersResult,
            commentsResult
        ] = await Promise.all([
            pool.query(
                `SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (
                        WHERE status = 'pending'
                    )::int AS pending,
                    COUNT(*) FILTER (
                        WHERE status = 'in_review'
                    )::int AS in_review,
                    COUNT(*) FILTER (
                        WHERE status = 'approved'
                    )::int AS approved,
                    COUNT(*) FILTER (
                        WHERE status = 'changes_requested'
                    )::int AS changes_requested
                 FROM submissions
                 WHERE project_id = $1`,
                [projectId]
            ),

            pool.query(
                `SELECT AVG(
                    EXTRACT(
                        EPOCH FROM (first_review.reviewed_at - s.created_at)
                    ) / 3600.0
                 )::double precision AS average_hours
                 FROM submissions s
                 JOIN (
                    SELECT submission_id, MIN(created_at) AS reviewed_at
                    FROM reviews
                    GROUP BY submission_id
                 ) first_review ON first_review.submission_id = s.id
                 WHERE s.project_id = $1`,
                [projectId]
            ),

            pool.query(
                `WITH activity AS (
                    SELECT r.reviewer_id AS user_id, 'review' AS kind
                    FROM reviews r
                    JOIN submissions s ON s.id = r.submission_id
                    WHERE s.project_id = $1

                    UNION ALL

                    SELECT c.user_id, 'comment' AS kind
                    FROM comments c
                    JOIN submissions s ON s.id = c.submission_id
                    WHERE s.project_id = $1
                 )
                 SELECT
                    u.id AS reviewer_id,
                    u.name AS reviewer_name,
                    COUNT(*) FILTER (
                        WHERE a.kind = 'review'
                    )::int AS review_count,
                    COUNT(*) FILTER (
                        WHERE a.kind = 'comment'
                    )::int AS comment_count,
                    COUNT(*)::int AS total_actions
                 FROM activity a
                 JOIN users u ON u.id = a.user_id
                 GROUP BY u.id, u.name
                 ORDER BY total_actions DESC, u.id ASC`,
                [projectId]
            ),

            pool.query(
                `SELECT s.id AS submission_id, s.title,
                        COUNT(c.id)::int AS comment_count
                 FROM submissions s
                 JOIN comments c ON c.submission_id = s.id
                 WHERE s.project_id = $1
                 GROUP BY s.id, s.title
                 ORDER BY comment_count DESC, s.id ASC
                 LIMIT 1`,
                [projectId]
            )
        ]);

        const totals = totalsResult.rows[0];
        const decidedCount = totals.approved + totals.changes_requested;

        const percentage = (count: number) =>
            decidedCount === 0
                ? null
                : Number(((count / decidedCount) * 100).toFixed(2));

        const averageHours = timingResult.rows[0].average_hours;

        return res.status(200).json({
            project: projectResult.rows[0],
            submissions: totals,

            decision_percentages: {
                denominator: "currently approved or changes_requested",
                approved: percentage(totals.approved),
                changes_requested: percentage(totals.changes_requested)
            },

            average_time_to_first_review_hours:
                averageHours === null
                    ? null
                    : Number(averageHours.toFixed(2)),

            reviewer_activity: reviewersResult.rows,

            most_commented_submission:
                commentsResult.rows[0] ?? null
        });
    } catch (error) {
        return next(error);
    }
};