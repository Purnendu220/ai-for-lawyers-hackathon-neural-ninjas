/** Region for Firestore, Storage and Cloud Functions. Permanent once the project is created. */
export const FUNCTIONS_REGION = 'asia-south1';

/** Every date shown to users is rendered in India Standard Time. */
export const APP_TIME_ZONE = 'Asia/Kolkata';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_ANALYSED_PAGES = 60;
export const MAX_ORGS_PER_USER = 10;

export const ALLOWED_UPLOAD_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
} as const;

export type AllowedMimeType = keyof typeof ALLOWED_UPLOAD_TYPES;
