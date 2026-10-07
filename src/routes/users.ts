import { Router } from "express";
import { body, param } from "express-validator";

import {
    getUserById,
    updateUser,
    deleteUser
} from "../controllers/users";

import {
    authenticate,
    authorize
} from "../middleware/auth";

import { validate } from "../middleware/validate";

import {
    getUserNotifications
} from "../controllers/notifications";

const router = Router();

router.use(authenticate);

router.get(
    "/:id/notifications",
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("User ID must be a positive integer")
    ],
    validate,
    getUserNotifications
);

router.get(
    "/:id",
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("User ID must be a positive integer")
    ],
    validate,
    getUserById
);

router.put(
    "/:id",
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("User ID must be a positive integer"),

        body("name")
            .optional()
            .isString()
            .withMessage("Name must be a string")
            .bail()
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage("Name must be between 1 and 100 characters"),

        body("email")
            .optional()
            .isString()
            .withMessage("Email must be a string")
            .bail()
            .trim()
            .isLength({ max: 255 })
            .withMessage("Email must not exceed 255 characters")
            .isEmail()
            .withMessage("A valid email is required"),

        body("password")
            .optional()
            .isString()
            .withMessage("Password must be a string")
            .bail()
            .isLength({ min: 6 })
            .withMessage("Password must be at least 6 characters"),

        body("profile_picture")
            .optional()
            .isString()
            .withMessage("Profile picture must be a string")
    ],
    validate,
    updateUser
);

router.delete(
    "/:id",
    [
        param("id")
            .isInt({ min: 1, max: 2147483647 })
            .withMessage("User ID must be a positive integer")
    ],
    validate,
    authorize("reviewer"),
    deleteUser
);

export default router;