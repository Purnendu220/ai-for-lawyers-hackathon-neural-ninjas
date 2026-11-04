/** Firestore document and collection paths (blueprint §5, docs/ARCHITECTURE.md §7). */
export const paths = {
  user: (uid: string) => `users/${uid}`,

  org: (orgId: string) => `organizations/${orgId}`,
  members: (orgId: string) => `organizations/${orgId}/members`,
  member: (orgId: string, uid: string) => `organizations/${orgId}/members/${uid}`,
  invitations: (orgId: string) => `organizations/${orgId}/invitations`,
  invitation: (orgId: string, inviteId: string) =>
    `organizations/${orgId}/invitations/${inviteId}`,
  auditLogs: (orgId: string) => `organizations/${orgId}/auditLogs`,
  jobs: (orgId: string) => `organizations/${orgId}/jobs`,
  job: (orgId: string, jobId: string) => `organizations/${orgId}/jobs/${jobId}`,
  usage: (orgId: string, day: string) => `organizations/${orgId}/usage/${day}`,

  cases: (orgId: string) => `organizations/${orgId}/cases`,
  case: (orgId: string, caseId: string) => `organizations/${orgId}/cases/${caseId}`,
  documents: (orgId: string, caseId: string) => `organizations/${orgId}/cases/${caseId}/documents`,
  document: (orgId: string, caseId: string, documentId: string) =>
    `organizations/${orgId}/cases/${caseId}/documents/${documentId}`,
  analyses: (orgId: string, caseId: string) => `organizations/${orgId}/cases/${caseId}/analyses`,
  analysis: (orgId: string, caseId: string, analysisId: string) =>
    `organizations/${orgId}/cases/${caseId}/analyses/${analysisId}`,
  tasks: (orgId: string, caseId: string) => `organizations/${orgId}/cases/${caseId}/tasks`,
  task: (orgId: string, caseId: string, taskId: string) =>
    `organizations/${orgId}/cases/${caseId}/tasks/${taskId}`,
  events: (orgId: string, caseId: string) => `organizations/${orgId}/cases/${caseId}/events`,
  event: (orgId: string, caseId: string, eventId: string) =>
    `organizations/${orgId}/cases/${caseId}/events/${eventId}`,
  messages: (orgId: string, caseId: string) => `organizations/${orgId}/cases/${caseId}/messages`,
};

/** Cloud Storage object paths. The object name is fixed; user file names never reach a path. */
export const ORIGINAL_UPLOAD_PATH = /^orgs\/([A-Za-z0-9_-]+)\/cases\/([A-Za-z0-9_-]+)\/documents\/([A-Za-z0-9_-]+)\/original$/;

export const storagePaths = {
  documentFolder: (orgId: string, caseId: string, documentId: string) =>
    `orgs/${orgId}/cases/${caseId}/documents/${documentId}`,
  original: (orgId: string, caseId: string, documentId: string) =>
    `${storagePaths.documentFolder(orgId, caseId, documentId)}/original`,
  pages: (orgId: string, caseId: string, documentId: string) =>
    `${storagePaths.documentFolder(orgId, caseId, documentId)}/pages.json`,
  chunks: (orgId: string, caseId: string, documentId: string) =>
    `${storagePaths.documentFolder(orgId, caseId, documentId)}/chunks.json`,
};
