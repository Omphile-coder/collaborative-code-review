import { Router } from "express";
import { body, param } from "express-validator";

import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

import {
    createProject,
    getProjects,
    getProjectById,
    addProjectMember,
    removeProjectMember
} from "../controllers/projects";

import {
    getProjectSubmissions
} from "../controllers/submissions";

import { getProjectStats } from "../controllers/stats";

const router = Router();

router.use(authenticate);

router.post(
    "/",
    [
        body("name")
            .isString()
            .withMessage("Project name must be a string")
            .bail()
            .trim()
            .isLength({ min: 1, max: 150 })
            .withMessage(
                "Project name must be between 1 and 150 characters"
            ),

        body("description")
            .optional()
            .isString()
            .withMessage("Description must be a string")
    ],
    validate,
    createProject
);

router.get("/", getProjects);

router.post(
    "/:id/members",
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Project ID must be a positive integer"),

        body("user_id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("User ID must be a positive integer")
    ],
    validate,
    addProjectMember
);

router.delete(
    "/:id/members/:userId",
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Project ID must be a positive integer"),

        param("userId")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("User ID must be a positive integer")
    ],
    validate,
    removeProjectMember
);

router.get(
    "/:id/submissions",
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Project ID must be a positive integer")
    ],
    validate,
    getProjectSubmissions
);

router.get(
    "/:id/stats",
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Project ID must be a positive integer")
    ],
    validate,
    getProjectStats
);

router.get(
    "/:id",
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Project ID must be a positive integer")
    ],
    validate,
    getProjectById
);

export default router;