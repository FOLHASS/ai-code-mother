/**
 * Public application-management API facade.
 *
 * The generated controller remains the transport implementation. Keeping the
 * imports behind this module gives feature code one stable API boundary while
 * preserving the generated request and response types during the migration.
 */
export {
  addApp,
  adminDeleteApp,
  adminGetAppVoById,
  adminListAppVoByPage,
  adminUpdateApp,
  deleteApp,
  deploy,
  downloadAppCode,
  getAppVoById,
  listGoodAppVoByPage,
  listMyAppVoByPage,
  updateApp,
} from '@/api/appController.ts'
