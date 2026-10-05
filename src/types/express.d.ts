import { AuthenticatedRequestUser } from "./auth";

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedRequestUser;
        }
    }
}

export {};