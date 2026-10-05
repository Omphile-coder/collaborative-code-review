import { Request, Response } from "express";
import pool from "../config/database";


export const createProject = async (req: Request, res: Response) => { 

    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    try {
        const { name, description } = req.body;

        const result = await pool.query(
            `INSERT INTO projects (name, description, created_by)
             VALUES ($1, $2, $3)
             RETURNING id, name, description, created_by, created_at`,
            [name, description ?? null, req.user.id]
        );

        return res.status(201).json({
            message: "Project created successfully",
            project: result.rows[0]
        });
    }
    catch (error) { 
        console.error("Error creating project:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
     

}

export const getProjects = async (req: Request, res: Response) => {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    try {
        const result = await pool.query(
            `SELECT p.id, p.name, p.description, p.created_by, p.created_at, p.updated_at, u.name AS created_by_name
             FROM projects p
             WHERE p.created_by = $1 OR EXISTS(
                 SELECT 1
                 FROM project_members pm
                 WHERE pm.project_id = p.id AND pm.user_id = $1
             )
             ORDER BY p.created_at DESC`,
            [req.user.id]
        );

        return res.status(200).json({
            projects: result.rows
        });
            
        
    } catch (error) { 
        console.error("List projects error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });

    }
 }