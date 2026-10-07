import { Router } from "express";
import { body, param } from "express-validator";

import {
    authenticate,
    authorize
} from "../middleware/auth";

import { validate } from "../middleware/validate";

import {
    createSubmission,
    getSubmissionById,
    updateSubmissionStatus,
    deleteSubmission
} from "../controllers/submissions";

import {
    addComment,
    getSubmissionComments
} from "../controllers/comments";

import {
    approveSubmission,
    requestSubmissionChanges,
    getSubmissionReviews
} from "../controllers/reviews";

const router = Router();

router.use(authenticate);

router.post(
    "/",
    [
        body("project_id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Project ID must be a positive integer"),

        body("title")
            .isString()
            .withMessage("Title must be a string")
            .bail()
            .trim()
            .isLength({ min: 1, max: 200 })
            .withMessage("Title must be between 1 and 200 characters"),

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
            .isIn(["pending", "in_review"])
            .withMessage(
                "Use the review endpoints to approve or request changes"
            )
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

router.post(
    "/:id/approve",
    authorize("reviewer"),
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Submission ID must be a positive integer"),

        body("feedback")
            .optional()
            .isString()
            .withMessage("Feedback must be a string")
            .bail()
            .trim()
    ],
    validate,
    approveSubmission
);

router.post(
    "/:id/request-changes",
    authorize("reviewer"),
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Submission ID must be a positive integer"),

        body("feedback")
            .isString()
            .withMessage("Feedback must be a string")
            .bail()
            .trim()
            .notEmpty()
            .withMessage(
                "Feedback is required when requesting changes"
            )
    ],
    validate,
    requestSubmissionChanges
);

router.get(
    "/:id/reviews",
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Submission ID must be a positive integer")
    ],
    validate,
    getSubmissionReviews
);

export default router;