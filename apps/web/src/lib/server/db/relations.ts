import { defineRelations } from 'drizzle-orm';
import * as schema from './schema';
import { authRelations } from './auth.schema';

// Parts such as authRelations must be spread after the full defineRelations result.
export const relations = { ...defineRelations(schema, () => ({})), ...authRelations };
