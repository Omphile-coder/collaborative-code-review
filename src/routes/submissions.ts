import {
    Router,
    Request,
    Response,
    NextFunction
} from "express";

import { body, param ,validationResult } from "express-validator";
import {
    authenticate,
    authorize
} from "../middleware/auth";
import {
    createSubmission,
    getSubmissionById,
    updateSubmissionStatus,
     deleteSubmission
} from "../controllers/submissions";
import { addComment, getSubmissionComments  } from "../controllers/comments";


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
        body("project_id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage(
                "Project ID must be a positive integer"
            ),

        body("title")
            .isString()
            .withMessage("Title must be a string")
            .bail()
            .trim()
            .isLength({ min: 1, max: 200 })
            .withMessage(
                "Title must be between 1 and 200 characters"
            ),

        body("code")
            .isString()
            .withMessage("Code must be a string")
            .bail()
            .notEmpty()
            .withMessage("Code is required"),

        body("language")
            .optional()
            .isString()
            .withMessage("Language must be a string")
    ],
    validate,
    createSubmission
);

router.get(
    "/:id",
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Submission ID must be a positive integer")
    ],
    validate,
    getSubmissionById
);
router.put(
    "/:id/status",
    authorize("reviewer"),
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Submission ID must be a positive integer"),

        body("status")
            .isString()
            .withMessage("Status must be a string")
            .bail()
            .isIn([
                "pending",
                "in_review",
                "approved",
                "changes_requested"
            ])
            .withMessage("Invalid submission status")
    ],
    validate,
    updateSubmissionStatus
);

router.delete(
    "/:id",
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Submission ID must be a positive integer")
    ],
    validate,
    deleteSubmission
);

router.post(
    "/:id/comments",
    authorize("reviewer"),
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Submission ID must be a positive integer"),

        body("content")
            .isString()
            .withMessage("Comment content must be a string")
            .bail()
            .trim()
            .notEmpty()
            .withMessage("Comment content is required"),

        body("line_number")
            .optional({ values: "null" })
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Line number must be a positive integer")
    ],
    validate,
    addComment
);

router.get(
    "/:id/comments",
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Submission ID must be a positive integer")
    ],
    validate,
    getSubmissionComments
);

export default router;