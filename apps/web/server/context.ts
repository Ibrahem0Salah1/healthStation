import {db} from '@repo/database';
import { getUserFromRequest } from './auth';
export async function createTRPCContext() {
  const auth =
    await getUserFromRequest();

  return {
    db,
    session: auth?.session ?? null,
    user: auth?.user ?? null,
  };
}
export type TRPCContext = Awaited<
  ReturnType<typeof createTRPCContext>
>;