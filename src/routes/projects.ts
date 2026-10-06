import { Router, Request, Response, NextFunction } from "express";
import { body,param, validationResult } from "express-validator";
import { authenticate } from "../middleware/auth";
import {
    createProject,
    getProjects,
    getProjectById,
    addProjectMember,
    removeProjectMember
} from "../controllers/projects";
import { getProjectSubmissions } from "../controllers/submissions";

const router = Router();

const validate = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            errors: errors.array()
        });
    }

    next();
};

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
            .withMessage("Project name must be between 1 and 150 characters"),

        body("description")
            .optional()
            .isString()
            .withMessage("Description must be a string")
    ],
    validate,
    createProject
);

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

router.get("/", getProjects);

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