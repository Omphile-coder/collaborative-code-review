import { Request, Response, NextFunction } from "express";
import type { PoolClient } from "pg";
import pool from "../config/database";

export const createProject = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    let client: PoolClient | undefined;
    let transactionStarted = false;

    try {
        client = await pool.connect();

        const { name, description } = req.body;

        await client.query("BEGIN");
        transactionStarted = true;

        const projectResult = await client.query(
            `INSERT INTO projects (name, description, created_by)
             VALUES ($1, $2, $3)
             RETURNING id, name, description, created_by,
                       created_at, updated_at`,
            [name, description ?? null, req.user.id]
        );

        const project = projectResult.rows[0];

        await client.query(
            `INSERT INTO project_members (project_id, user_id)
             VALUES ($1, $2)`,
            [project.id, req.user.id]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return res.status(201).json({
            message: "Project created successfully",
            project
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

export const getProjects = async (
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
            `SELECT p.id, p.name, p.description, p.created_by,
                    p.created_at, p.updated_at
             FROM projects p
             WHERE p.created_by = $1
                OR EXISTS (
                    SELECT 1
                    FROM project_members pm
                    WHERE pm.project_id = p.id
                      AND pm.user_id = $1
                )
             ORDER BY p.created_at DESC, p.id DESC`,
            [req.user.id]
        );

        return res.status(200).json({
            projects: result.rows
        });
    } catch (error) {
        return next(error);
    }
};

export const addProjectMember = async (
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
        const userId = Number(req.body.user_id);

        const projectResult = await pool.query(
            "SELECT created_by FROM projects WHERE id = $1",
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        const creatorId = projectResult.rows[0].created_by;

        if (creatorId !== req.user.id) {
            return res.status(403).json({
                message: "Only the project creator can manage members"
            });
        }

        if (userId === creatorId) {
            return res.status(400).json({
                message: "The project creator already has access"
            });
        }

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
            `INSERT INTO project_members (project_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (project_id, user_id) DO NOTHING
             RETURNING project_id, user_id, joined_at`,
            [projectId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(409).json({
                message: "User is already a project member"
            });
        }

        return res.status(201).json({
            message: "Member added successfully",
            member: result.rows[0]
        });
    } catch (error) {
        return next(error);
    }
};

export const removeProjectMember = async (
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
        const userId = Number(req.params.userId);

        const projectResult = await pool.query(
            "SELECT created_by FROM projects WHERE id = $1",
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        const creatorId = projectResult.rows[0].created_by;

        if (creatorId !== req.user.id) {
            return res.status(403).json({
                message: "Only the project creator can manage members"
            });
        }

        if (userId === creatorId) {
            return res.status(400).json({
                message: "The project creator cannot be removed"
            });
        }

        const result = await pool.query(
            `DELETE FROM project_members
             WHERE project_id = $1 AND user_id = $2
             RETURNING user_id`,
            [projectId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Project member not found"
            });
        }

        return res.status(200).json({
            message: "Member removed successfully"
        });
    } catch (error) {
        return next(error);
    }
};

export const getProjectById = async (
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
            `SELECT p.id, p.name, p.description, p.created_by,
                    p.created_at, p.updated_at,
                    u.name AS creator_name,
                    u.email AS creator_email
             FROM projects p
             JOIN users u ON u.id = p.created_by
             WHERE p.id = $1`,
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        const project = projectResult.rows[0];

        const accessResult = await pool.query(
            `SELECT 1
             FROM project_members
             WHERE project_id = $1 AND user_id = $2`,
            [projectId, req.user.id]
        );

        const isCreator = project.created_by === req.user.id;
        const isMember = accessResult.rows.length > 0;

        if (!isCreator && !isMember) {
            return res.status(403).json({
                message: "You do not have access to this project"
            });
        }

        const membersResult = await pool.query(
            `SELECT u.id, u.name, u.email, u.role,
                    u.profile_picture, pm.joined_at
             FROM project_members pm
             JOIN users u ON u.id = pm.user_id
             WHERE pm.project_id = $1
             ORDER BY pm.joined_at ASC, u.id ASC`,
            [projectId]
        );

        return res.status(200).json({
            project: {
                id: project.id,
                name: project.name,
                description: project.description,
                created_by: project.created_by,
                creator: {
                    name: project.creator_name,
                    email: project.creator_email
                },
                created_at: project.created_at,
                updated_at: project.updated_at
            },
            members: membersResult.rows
        });
    } catch (error) {
        return next(error);
    }
};