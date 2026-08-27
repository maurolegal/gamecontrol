type AdminClient = {
  auth: {
    admin: {
      listUsers: (options: { page: number; perPage: number }) => Promise<{ data?: { users?: Array<{ id?: string; email?: string | null }> }; error?: Error | null }>;
      inviteUserByEmail: (email: string, options: { data: { nombre: string } }) => Promise<{ data?: { user?: { id?: string } }; error?: Error | null }>;
    };
  };
};

export async function findAuthUserIdByEmail(admin: AdminClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    const match = users.find((user) => (user.email ?? '').toLowerCase() === email.toLowerCase());
    if (match?.id) return match.id;
    if (users.length < 200) return null;
  }
  return null;
}

export async function ensureAuthUser(
  admin: AdminClient,
  email: string,
  name: string,
): Promise<{ id: string; created: boolean }> {
  const existingUserId = await findAuthUserIdByEmail(admin, email);
  if (existingUserId) return { id: existingUserId, created: false };

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    { data: { nombre: name } },
  );
  const invitedUserId = invited?.user?.id;
  if (!inviteError && invitedUserId) return { id: invitedUserId, created: true };

  const recoveredUserId = await findAuthUserIdByEmail(admin, email);
  if (!recoveredUserId) throw new Error('No se pudo invitar al administrador');
  return { id: recoveredUserId, created: false };
}
