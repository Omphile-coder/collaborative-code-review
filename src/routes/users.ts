import { Router } from "express";
import {
    getUserById,
    updateUser,
    deleteUser
} from "../controllers/users";
import {
    authenticate,
    authorize
} from "../middleware/auth";
import {
    body,
    param,
    validationResult
} from "express-validator";

const router = Router();

const validate = (
    req: any,
    res: any,
    next: any
) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            errors: errors.array()
        });
    }

    next();
};

router.get(
    "/:id",
    authenticate,
    param("id")
        .isInt()
        .withMessage("User ID must be an integer"),
    validate,
    getUserById
);

router.put(
    "/:id",
    authenticate,
    [
        param("id")
            .isInt()
            .withMessage("User ID must be an integer"),

        body("name")
            .optional()
            .isString()
            .withMessage("Name must be a string"),

        body("email")
            .optional()
            .isEmail()
            .withMessage("A valid email is required"),

        body("password")
            .optional()
            .isLength({ min: 6 })
            .withMessage("Password must be at least 6 characters")
    ],
    validate,
    updateUser
);

router.delete(
    "/:id",
    authenticate,
    param("id")
        .isInt()
        .withMessage("User ID must be an integer"),
    validate,
    authorize("reviewer"),
    deleteUser
);

export default router;