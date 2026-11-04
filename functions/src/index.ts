// Must stay the first import: initializes the Admin SDK and global function options.
import './core/firebase';

export { createOrganization } from './callables/org';
export { acceptInvitation, inviteMember, revokeInvitation, updateMember } from './callables/team';
export { archiveCase, createCase, updateCase } from './callables/cases';
export { analyzeDocument, startUpload } from './callables/documents';
export { reviewAnalysis } from './callables/review';
export {
  createEvent,
  createTask,
  listCaseActivity,
  updateEvent,
  updateTask,
  verifyEvent,
} from './callables/work';
export { askCaseCopilot, translateSummary } from './callables/copilot';
export { recoverStuckJobs } from './scheduled/recoverStuckJobs';
export { onUploadFinalized } from './triggers/onUploadFinalized';
export { processDocument } from './tasks/processDocument';
export { runAnalysis } from './tasks/runAnalysis';
