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

const router = Router();

router.get(
    "/:id",
    authenticate,
    getUserById
);

router.put(
    "/:id",
    authenticate,
    updateUser
);

router.delete(
    "/:id",
    authenticate,
    authorize("reviewer"),
    deleteUser
);

export default router;