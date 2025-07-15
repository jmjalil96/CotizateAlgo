import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting RBAC seed...');

  // Create Roles
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'broker_admin' },
      update: {},
      create: {
        name: 'broker_admin',
        description: 'Administrator with full access to the broker system',
      },
    }),
    prisma.role.upsert({
      where: { name: 'employee' },
      update: {},
      create: {
        name: 'employee',
        description: 'Employee with access to manage clients and view reports',
      },
    }),
    prisma.role.upsert({
      where: { name: 'agent' },
      update: {},
      create: {
        name: 'agent',
        description: 'Agent with limited access to their own clients',
      },
    }),
  ]);

  console.log('Roles created:', roles.map(r => r.name));

  // Define permissions for each resource
  const permissionsData = [
    // Invitations permissions
    { resource: 'invitations', action: 'create', description: 'Create new invitations' },
    { resource: 'invitations', action: 'read', description: 'View invitations' },
    { resource: 'invitations', action: 'update', description: 'Update invitation status' },
    { resource: 'invitations', action: 'delete', description: 'Delete invitations' },
    
    // Clients permissions
    { resource: 'clients', action: 'create', description: 'Create new clients' },
    { resource: 'clients', action: 'read', description: 'View clients' },
    { resource: 'clients', action: 'update', description: 'Update client information' },
    { resource: 'clients', action: 'delete', description: 'Delete clients' },
    { resource: 'clients', action: 'read:own', description: 'View own clients only' },
    { resource: 'clients', action: 'update:own', description: 'Update own clients only' },
    
    // Users permissions
    { resource: 'users', action: 'create', description: 'Create new users' },
    { resource: 'users', action: 'read', description: 'View all users' },
    { resource: 'users', action: 'update', description: 'Update user information' },
    { resource: 'users', action: 'delete', description: 'Delete users' },
    { resource: 'users', action: 'read:own', description: 'View own user profile' },
    { resource: 'users', action: 'update:own', description: 'Update own user profile' },
    { resource: 'users', action: 'assign:roles', description: 'Assign roles to users' },
  ];

  // Create permissions
  const permissions = await Promise.all(
    permissionsData.map(perm =>
      prisma.permission.upsert({
        where: {
          resource_action: {
            resource: perm.resource,
            action: perm.action,
          },
        },
        update: {},
        create: perm,
      })
    )
  );

  console.log(`Created ${permissions.length} permissions`);

  // Define role-permission mappings
  const rolePermissions = {
    broker_admin: [
      // Full access to all resources
      'invitations:create',
      'invitations:read',
      'invitations:update',
      'invitations:delete',
      'clients:create',
      'clients:read',
      'clients:update',
      'clients:delete',
      'users:create',
      'users:read',
      'users:update',
      'users:delete',
      'users:assign:roles',
    ],
    employee: [
      // Can manage clients and view users
      'invitations:read',
      'clients:create',
      'clients:read',
      'clients:update',
      'users:read',
      'users:read:own',
      'users:update:own',
    ],
    agent: [
      // Can only manage their own clients and profile
      'clients:create',
      'clients:read:own',
      'clients:update:own',
      'users:read:own',
      'users:update:own',
    ],
  };

  // Assign permissions to roles
  for (const [roleName, permissionNames] of Object.entries(rolePermissions)) {
    const role = roles.find(r => r.name === roleName);
    if (!role) continue;

    for (const permName of permissionNames) {
      const [resource, action] = permName.split(':');
      const permission = permissions.find(
        p => p.resource === resource && p.action === action
      );
      
      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }
  }

  console.log('Role-permission mappings created');
  console.log('RBAC seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });