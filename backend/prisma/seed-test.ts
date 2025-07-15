import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

// Initialize Supabase Admin client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Test data
const testUsers = [
  // Parent Broker Admins
  {
    email: 'admin@segurosatlas.com',
    password: 'Test123!',
    firstName: 'Carlos',
    lastName: 'Mendoza',
    cedulaRuc: '1710234567',
    phone: '0991234567',
    brokerName: 'Seguros Atlas',
    brokerDescription: 'Líder en seguros corporativos y personales',
    role: 'broker_admin',
    isParent: true
  },
  {
    email: 'admin@protectseguros.com',
    password: 'Test123!',
    firstName: 'María',
    lastName: 'Rodríguez',
    cedulaRuc: '1712345678',
    phone: '0992345678',
    brokerName: 'Protect Seguros',
    brokerDescription: 'Especialistas en seguros de vida y salud',
    role: 'broker_admin',
    isParent: true
  },
  // Employees at parent brokers
  {
    email: 'empleado1@segurosatlas.com',
    password: 'Test123!',
    firstName: 'Juan',
    lastName: 'Pérez',
    cedulaRuc: '1713456789',
    phone: '0993456789',
    brokerName: 'Seguros Atlas',
    role: 'employee',
    isParent: false
  },
  {
    email: 'empleado2@segurosatlas.com',
    password: 'Test123!',
    firstName: 'Ana',
    lastName: 'Vargas',
    cedulaRuc: '1714567890',
    phone: '0994567890',
    brokerName: 'Seguros Atlas',
    role: 'employee',
    isParent: false
  },
  {
    email: 'empleado@protectseguros.com',
    password: 'Test123!',
    firstName: 'Luis',
    lastName: 'Castro',
    cedulaRuc: '1715678901',
    phone: '0995678901',
    brokerName: 'Protect Seguros',
    role: 'employee',
    isParent: false
  },
  // Agents (child brokers)
  {
    email: 'agente1@atlas.com',
    password: 'Test123!',
    firstName: 'Pedro',
    lastName: 'Jiménez',
    cedulaRuc: '1716789012',
    phone: '0996789012',
    brokerName: 'Atlas Norte',
    brokerDescription: 'Agencia Norte - Seguros Atlas',
    parentBroker: 'Seguros Atlas',
    role: 'agent',
    isParent: false
  },
  {
    email: 'agente2@atlas.com',
    password: 'Test123!',
    firstName: 'Sofía',
    lastName: 'Morales',
    cedulaRuc: '1717890123',
    phone: '0997890123',
    brokerName: 'Atlas Sur',
    brokerDescription: 'Agencia Sur - Seguros Atlas',
    parentBroker: 'Seguros Atlas',
    role: 'agent',
    isParent: false
  },
  {
    email: 'agente3@atlas.com',
    password: 'Test123!',
    firstName: 'Roberto',
    lastName: 'Gutiérrez',
    cedulaRuc: '1718901234',
    phone: '0998901234',
    brokerName: 'Atlas Centro',
    brokerDescription: 'Agencia Centro - Seguros Atlas',
    parentBroker: 'Seguros Atlas',
    role: 'agent',
    isParent: false
  },
  {
    email: 'agente1@protect.com',
    password: 'Test123!',
    firstName: 'Diana',
    lastName: 'Flores',
    cedulaRuc: '1719012345',
    phone: '0999012345',
    brokerName: 'Protect Valle',
    brokerDescription: 'Agencia Valle - Protect Seguros',
    parentBroker: 'Protect Seguros',
    role: 'agent',
    isParent: false
  },
  {
    email: 'agente2@protect.com',
    password: 'Test123!',
    firstName: 'Miguel',
    lastName: 'Herrera',
    cedulaRuc: '1720123456',
    phone: '0990123456',
    brokerName: 'Protect Costa',
    brokerDescription: 'Agencia Costa - Protect Seguros',
    parentBroker: 'Protect Seguros',
    role: 'agent',
    isParent: false
  }
];

// Test clients
const testClients = [
  // Clients for Seguros Atlas (parent)
  {
    firstName: 'Andrea',
    lastName: 'López',
    cedulaRuc: '1721234567',
    email: 'andrea.lopez@email.com',
    phone: '0981234567',
    brokerName: 'Seguros Atlas'
  },
  {
    firstName: 'Fernando',
    lastName: 'Silva',
    cedulaRuc: '1722345678',
    email: 'fernando.silva@email.com',
    phone: '0982345678',
    brokerName: 'Seguros Atlas'
  },
  // Clients for Atlas Norte (child)
  {
    firstName: 'Gabriela',
    lastName: 'Ramos',
    cedulaRuc: '1723456789',
    email: 'gabriela.ramos@email.com',
    phone: '0983456789',
    brokerName: 'Atlas Norte'
  },
  {
    firstName: 'Javier',
    lastName: 'Ortiz',
    cedulaRuc: '1724567890',
    email: 'javier.ortiz@email.com',
    phone: '0984567890',
    brokerName: 'Atlas Norte'
  },
  // Clients for Atlas Sur (child)
  {
    firstName: 'Lucía',
    lastName: 'Mendez',
    cedulaRuc: '1725678901',
    email: 'lucia.mendez@email.com',
    phone: '0985678901',
    brokerName: 'Atlas Sur'
  },
  // Clients for Protect Seguros (parent)
  {
    firstName: 'Ricardo',
    lastName: 'Vega',
    cedulaRuc: '1726789012',
    email: 'ricardo.vega@email.com',
    phone: '0986789012',
    brokerName: 'Protect Seguros'
  },
  {
    firstName: 'Patricia',
    lastName: 'Ruiz',
    cedulaRuc: '1727890123',
    email: 'patricia.ruiz@email.com',
    phone: '0987890123',
    brokerName: 'Protect Seguros'
  },
  // Clients for Protect Valle (child)
  {
    firstName: 'Daniel',
    lastName: 'Torres',
    cedulaRuc: '1728901234',
    email: 'daniel.torres@email.com',
    phone: '0988901234',
    brokerName: 'Protect Valle'
  },
  // Clients for Protect Costa (child)
  {
    firstName: 'Carmen',
    lastName: 'Díaz',
    cedulaRuc: '1729012345',
    email: 'carmen.diaz@email.com',
    phone: '0989012345',
    brokerName: 'Protect Costa'
  },
  {
    firstName: 'Andrés',
    lastName: 'Paredes',
    cedulaRuc: '1730123456',
    email: 'andres.paredes@email.com',
    phone: '0980123456',
    brokerName: 'Protect Costa'
  }
];

async function clearDatabase() {
  console.log('🗑️  Clearing database...');
  
  // Delete in correct order to respect foreign key constraints
  await prisma.client.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.broker.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  
  // Also clear Supabase auth users
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
  if (users && users.length > 0) {
    for (const user of users) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
    }
  }
  
  console.log('✅ Database cleared');
}

async function seedRolesAndPermissions() {
  console.log('🔐 Creating roles and permissions...');
  
  // Create roles with levels
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'broker_admin' },
      update: { level: 1 },
      create: {
        name: 'broker_admin',
        description: 'Administrator with full access to the broker system',
        level: 1
      }
    }),
    prisma.role.upsert({
      where: { name: 'employee' },
      update: { level: 2 },
      create: {
        name: 'employee',
        description: 'Employee with access to manage clients and view reports',
        level: 2
      }
    }),
    prisma.role.upsert({
      where: { name: 'agent' },
      update: { level: 3 },
      create: {
        name: 'agent',
        description: 'Agent with limited access to their own clients',
        level: 3
      }
    })
  ]);

  // Create permissions
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

  const permissions = await Promise.all(
    permissionsData.map(perm => prisma.permission.upsert({
      where: {
        resource_action: {
          resource: perm.resource,
          action: perm.action
        }
      },
      update: {},
      create: perm
    }))
  );

  // Assign permissions to roles
  const rolePermissions = {
    broker_admin: [
      'invitations:create', 'invitations:read', 'invitations:update', 'invitations:delete',
      'clients:create', 'clients:read', 'clients:update', 'clients:delete',
      'users:create', 'users:read', 'users:update', 'users:delete', 'users:assign:roles'
    ],
    employee: [
      'invitations:read',
      'clients:create', 'clients:read', 'clients:update',
      'users:read', 'users:read:own', 'users:update:own'
    ],
    agent: [
      'clients:create', 'clients:read:own', 'clients:update:own',
      'users:read:own', 'users:update:own'
    ]
  };

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
              permissionId: permission.id
            }
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id
          }
        });
      }
    }
  }

  console.log('✅ Roles and permissions created');
  return roles;
}

async function seedBrokersAndUsers(roles: any[]) {
  console.log('🏢 Creating brokers and users...');
  
  const brokerMap = new Map();
  const userMap = new Map();

  // First, create parent brokers
  for (const userData of testUsers.filter(u => u.isParent)) {
    const broker = await prisma.broker.create({
      data: {
        name: userData.brokerName,
        description: userData.brokerDescription
      }
    });
    brokerMap.set(userData.brokerName, broker);
  }

  // Create users and assign to brokers
  for (const userData of testUsers) {
    // Get or create broker
    let broker = brokerMap.get(userData.brokerName);
    if (!broker && userData.parentBroker) {
      // Create child broker
      const parentBroker = brokerMap.get(userData.parentBroker);
      broker = await prisma.broker.create({
        data: {
          name: userData.brokerName,
          description: userData.brokerDescription,
          parentId: parentBroker.id
        }
      });
      brokerMap.set(userData.brokerName, broker);
    }

    // Create Supabase auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true
    });

    if (authError) {
      console.error(`Failed to create auth user ${userData.email}:`, authError);
      continue;
    }

    // Create profile
    const profile = await prisma.profile.create({
      data: {
        id: authUser.user.id,
        firstName: userData.firstName,
        lastName: userData.lastName,
        cedulaRuc: userData.cedulaRuc,
        phone: userData.phone,
        brokerId: broker.id,
        isActive: true
      }
    });

    // Assign role
    const role = roles.find(r => r.name === userData.role);
    if (role) {
      await prisma.userRole.create({
        data: {
          userId: profile.id,
          roleId: role.id
        }
      });
    }

    userMap.set(userData.email, profile);
    console.log(`✅ Created ${userData.role}: ${userData.firstName} ${userData.lastName} (${userData.email})`);
  }

  console.log('✅ All brokers and users created');
  return { brokerMap, userMap };
}

async function seedClients(brokerMap: Map<string, any>) {
  console.log('👥 Creating clients...');

  for (const clientData of testClients) {
    const broker = brokerMap.get(clientData.brokerName);
    if (!broker) {
      console.error(`Broker ${clientData.brokerName} not found for client ${clientData.firstName} ${clientData.lastName}`);
      continue;
    }

    await prisma.client.create({
      data: {
        firstName: clientData.firstName,
        lastName: clientData.lastName,
        cedulaRuc: clientData.cedulaRuc,
        email: clientData.email,
        phone: clientData.phone,
        brokerId: broker.id
      }
    });

    console.log(`✅ Created client: ${clientData.firstName} ${clientData.lastName} for ${clientData.brokerName}`);
  }

  console.log('✅ All clients created');
}

async function main() {
  try {
    console.log('🚀 Starting comprehensive test seed...\n');

    // Clear existing data
    await clearDatabase();

    // Seed in order
    const roles = await seedRolesAndPermissions();
    const { brokerMap } = await seedBrokersAndUsers(roles);
    await seedClients(brokerMap);

    console.log('\n✅ Test seed completed successfully!');
    console.log('\n📝 Test Credentials:');
    console.log('─────────────────────');
    console.log('Parent Broker Admins:');
    console.log('  admin@segurosatlas.com / Test123!');
    console.log('  admin@protectseguros.com / Test123!');
    console.log('\nEmployees:');
    console.log('  empleado1@segurosatlas.com / Test123!');
    console.log('  empleado@protectseguros.com / Test123!');
    console.log('\nAgents:');
    console.log('  agente1@atlas.com / Test123!');
    console.log('  agente1@protect.com / Test123!');
    console.log('\n🔍 Test scenarios to verify:');
    console.log('  - Broker admins can see all users/clients in their hierarchy');
    console.log('  - Employees can manage clients at parent broker level');
    console.log('  - Agents can only see their own broker\'s clients');
    console.log('  - Invitation flow works from parent to child brokers');
    console.log('  - RBAC permissions are properly enforced');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();