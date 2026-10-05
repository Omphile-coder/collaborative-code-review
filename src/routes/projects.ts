import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { authenticate } from "../middleware/auth";
import {
    createProject,
    getProjects
} from "../controllers/projects";