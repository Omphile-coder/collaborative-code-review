import {
    Request,
    Response,
    NextFunction
} from "express";

import { validationResult } from "express-validator";

export const validate = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            errors: errors.array().map((error) => {
                if (error.type === "field") {
                    return {
                        field: error.path,
                        location: error.location,
                        message: error.msg
                    };
                }

                return {
                    message: error.msg
                };
            })
        });
    }

    next();
};