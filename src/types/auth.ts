export interface AuthenticatedRequestUser {
    id: number;
    role: "reviewer" | "submitter";
}