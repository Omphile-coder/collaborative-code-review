import type { PoolClient } from "pg";

type NotificationType =
    | "comment_added"
    | "submission_approved"
    | "changes_requested";

interface NotificationInput {
    userId: number;
    actorId: number;
    submissionId: number;
    type: NotificationType;
    message: string;
}

export const createNotification = async (
    client: PoolClient,
    input: NotificationInput
) => {
    // Do not notify someone about their own action.
    if (input.userId === input.actorId) {
        return null;
    }

    const result = await client.query(
        `INSERT INTO notifications (
            user_id,
            actor_id,
            submission_id,
            type,
            message
         )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, actor_id, submission_id,
                   type, message, is_read, created_at`,
        [
            input.userId,
            input.actorId,
            input.submissionId,
            input.type,
            input.message
        ]
    );

    return result.rows[0];
};