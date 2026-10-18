/** Wire constants for God's live-event ingest (ADR-0019 §10). Crypto lives on the server and runner. */
export const GOD_INGEST_SIGNATURE_HEADER = 'x-god-signature';
export const GOD_INGEST_TIMESTAMP_HEADER = 'x-god-timestamp';
export const GOD_INGEST_MAX_SKEW_SEC = 300;
