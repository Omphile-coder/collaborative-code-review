CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL,
    reviewer_id INTEGER NOT NULL,
    decision VARCHAR(30) NOT NULL,
    feedback TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_review_submission
        FOREIGN KEY (submission_id)
        REFERENCES submissions(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_review_reviewer
        FOREIGN KEY (reviewer_id)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT review_decision_check
        CHECK (
            decision IN (
                'approved',
                'changes_requested'
            )
        )
);

CREATE INDEX idx_reviews_submission_history
    ON reviews (submission_id, created_at, id);