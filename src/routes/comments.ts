import {
    Router,
    Request,
    Response,
    NextFunction
} from "express";

import {
    body,
    param,
    validationResult
} from "express-validator";

import {
    authenticate,
    authorize
} from "../middleware/auth";

import { updateComment,  deleteComment } from "../controllers/comments";

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

router.put(
    "/:id",
    authorize("reviewer"),
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Comment ID must be a positive integer"),

        body("content")
            .isString()
            .withMessage("Comment content must be a string")
            .bail()
            .trim()
            .notEmpty()
            .withMessage("Comment content is required")
    ],
    validate,
    updateComment
);

router.delete(
    "/:id",
    authorize("reviewer"),
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("Comment ID must be a positive integer")
    ],
    validate,
    deleteComment
);

export default router;