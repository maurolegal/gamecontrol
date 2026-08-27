import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { ensureAuthUser } from './authUser.ts';

Deno.test('returns the newly invited Auth user id and marks it created', async () => {
  const admin = {
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: [] }, error: null }),
        inviteUserByEmail: async () => ({ data: { user: { id: 'new-auth-id' } }, error: null }),
      },
    },
  };

  const result = await ensureAuthUser(admin, 'new@example.com', 'New Admin');

  assertEquals(result, { id: 'new-auth-id', created: true });
});

Deno.test('uses recovered Auth user id when the invitation reports an existing user', async () => {
  let listCall = 0;
  let inviteCalls = 0;
  const admin = {
    auth: {
      admin: {
        listUsers: async () => {
          listCall += 1;
          return listCall === 1
            ? { data: { users: [] }, error: null }
            : { data: { users: [{ id: 'existing-auth-id', email: 'existing@example.com' }] }, error: null };
        },
        inviteUserByEmail: async () => {
          inviteCalls += 1;
          return { data: { user: undefined }, error: new Error('user already exists') };
        },
      },
    },
  };

  const result = await ensureAuthUser(admin, 'existing@example.com', 'Existing Admin');

  assertEquals(result, { id: 'existing-auth-id', created: false });
  assertEquals(inviteCalls, 1);
});
