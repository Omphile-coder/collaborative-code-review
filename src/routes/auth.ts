import { Router } from "express";
import { body } from "express-validator";
import { login, registerUser } from "../controllers/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.post(
  "/register",
  [
    body("name")
      .isString()
      .withMessage("Name must be a string")
      .bail()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name must be between 1 and 100 characters"),

    body("email")
      .isString()
      .withMessage("Email must be a string")
      .bail()
      .trim()
      .isLength({ max: 255 })
      .withMessage("Email must not exceed 255 characters")
      .isEmail()
      .withMessage("A valid email is required"),

    body("password")
      .isString()
      .withMessage("Password must be a string")
      .bail()
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("role")
      .optional()
      .isString()
      .withMessage("Role must be a string")
      .bail()
      .isIn(["reviewer", "submitter"])
      .withMessage("Role must be reviewer or submitter"),
  ],
  validate,
  registerUser,
);

router.post(
  "/login",
  [
    body("email")
      .isString()
      .withMessage("Email must be a string")
      .bail()
      .trim()
      .isEmail()
      .withMessage("A valid email is required"),

    body("password")
      .isString()
      .withMessage("Password must be a string")
      .bail()
      .notEmpty()
      .withMessage("Password is required"),
  ],
  validate,
  login,
);

export default router;
