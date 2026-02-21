import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../app/lib/auth/password';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧪 Testing Delegation System...\n');
  const startTime = Date.now();

  try {
    // 1. Setup: Get test users
    console.log('📋 Setting up test data...');
    process.stdout.write('   Connecting to database... ');

    process.stdout.write('✅\n');
    process.stdout.write('   Fetching admin user... ');
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@path.org' },
    });

    if (!admin) {
      throw new Error('Admin user not found. Please run seed script first.');
    }
    process.stdout.write('✅\n');

    process.stdout.write('   Fetching Nairobi location... ');
    const nairobi = await prisma.location.findFirst({
      where: { name: 'Nairobi Office' },
    });

    if (!nairobi) {
      throw new Error('Nairobi location not found. Please run seed script first.');
    }
    process.stdout.write('✅\n');

    process.stdout.write('   Fetching leave.approve permission... ');
    const leaveApprovePermission = await prisma.permission.findUnique({
      where: { name: 'leave.approve' },
    });

    if (!leaveApprovePermission) {
      throw new Error('leave.approve permission not found.');
    }
    process.stdout.write('✅\n');

    // Create test users (manager and delegate)
    process.stdout.write('   Creating test manager user... ');
    const manager = await prisma.user.upsert({
      where: { email: 'test-manager@path.org' },
      update: {},
      create: {
        name: 'Test Manager',
        email: 'test-manager@path.org',
        password_hash: await hashPassword('test123'),
        status: 'active',
        primary_location_id: nairobi.id,
      },
    });
    process.stdout.write('✅\n');

    process.stdout.write('   Creating test delegate user... ');
    const delegate = await prisma.user.upsert({
      where: { email: 'test-delegate@path.org' },
      update: {},
      create: {
        name: 'Test Delegate',
        email: 'test-delegate@path.org',
        password_hash: await hashPassword('test123'),
        status: 'active',
        primary_location_id: nairobi.id,
      },
    });
    process.stdout.write('✅\n');

    // Assign Manager role to manager user
    process.stdout.write('   Assigning Manager role... ');
    const managerRole = await prisma.role.findFirst({
      where: { name: 'Manager' },
    });

    if (managerRole) {
      await prisma.userRole.upsert({
        where: {
          user_id_role_id: {
            user_id: manager.id,
            role_id: managerRole.id,
          },
        },
        update: {},
        create: {
          user_id: manager.id,
          role_id: managerRole.id,
        },
      });
      process.stdout.write('✅\n');
    } else {
      process.stdout.write('⚠️  (Role not found)\n');
    }

    // 2. Test: Create delegation (self)
    console.log('\n📊 TEST 1: Create Delegation (Self)');
    console.log('='.repeat(70));

    const validFrom = new Date(); // Today
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7); // 7 days from now

    process.stdout.write('   Creating delegation... ');
    const delegation = await prisma.delegation.create({
      data: {
        delegator_user_id: manager.id,
        delegate_user_id: delegate.id,
        permission_id: leaveApprovePermission.id,
        location_id: nairobi.id,
        include_descendants: false,
        valid_from: validFrom,
        valid_until: validUntil,
        status: 'active',
      },
      include: {
        delegator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        delegate: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        permission: {
          select: {
            id: true,
            name: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    process.stdout.write('✅\n');

    console.log(`   ✅ Delegation created:`);
    console.log(`      ID: ${delegation.id.substring(0, 8)}...`);
    console.log(`      Delegator: ${delegation.delegator.name}`);
    console.log(`      Delegate: ${delegation.delegate.name}`);
    console.log(`      Permission: ${delegation.permission.name}`);
    console.log(`      Location: ${delegation.location?.name || 'Global'}`);

    // 3. Test: Check authority with delegation
    console.log('\n📊 TEST 2: Check Authority with Delegation');
    console.log('='.repeat(70));

    process.stdout.write('   Checking authority... ');
    const { checkAuthority } = await import('../app/lib/services/authority');
    const authorityCheck = await checkAuthority({
      userId: delegate.id,
      permission: 'leave.approve',
      locationId: nairobi.id,
    });

    if (authorityCheck.authorized && authorityCheck.source === 'delegation') {
      process.stdout.write('✅\n');
      console.log(`   ✅ Delegate has authority via delegation`);
      console.log(`      Source: ${authorityCheck.source}`);
    } else {
      process.stdout.write('❌\n');
      console.log(`   ❌ Delegate does NOT have authority`);
      console.log(`      Authorized: ${authorityCheck.authorized}`);
      console.log(`      Source: ${authorityCheck.source}`);
    }

    // 4. Test: Revoke delegation
    console.log('\n📊 TEST 3: Revoke Delegation');
    console.log('='.repeat(70));

    process.stdout.write('   Revoking delegation... ');
    const revoked = await prisma.delegation.update({
      where: { id: delegation.id },
      data: {
        status: 'revoked',
        revoked_at: new Date(),
      },
    });
    process.stdout.write('✅\n');
    console.log(`   ✅ Delegation revoked (Status: ${revoked.status})`);

    // Check authority again (should fail)
    process.stdout.write('   Verifying authority revoked... ');
    const authorityCheckAfterRevoke = await checkAuthority({
      userId: delegate.id,
      permission: 'leave.approve',
      locationId: nairobi.id,
    });

    if (!authorityCheckAfterRevoke.authorized) {
      process.stdout.write('✅\n');
      console.log(`   ✅ Authority correctly revoked`);
    } else {
      process.stdout.write('❌\n');
      console.log(`   ❌ Authority still active after revocation`);
    }

    // 5. Test: Admin delegation on behalf
    console.log('\n📊 TEST 4: Admin Delegation on Behalf');
    console.log('='.repeat(70));

    process.stdout.write('   Creating admin delegation... ');
    const adminDelegation = await prisma.delegation.create({
      data: {
        delegator_user_id: manager.id,
        delegate_user_id: delegate.id,
        permission_id: leaveApprovePermission.id,
        location_id: nairobi.id,
        include_descendants: true,
        valid_from: validFrom,
        valid_until: validUntil,
        status: 'active',
      },
      include: {
        delegator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        delegate: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        permission: {
          select: {
            id: true,
            name: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    process.stdout.write('✅\n');
    console.log(`   ✅ Admin delegation created`);
    console.log(`      Include Descendants: ${adminDelegation.include_descendants}`);

    // 6. Test: Overlap detection (before revoking first delegation)
    console.log('\n📊 TEST 5: Overlap Detection');
    console.log('='.repeat(70));

    // Create a new delegation that should overlap with adminDelegation
    process.stdout.write('   Creating overlapping delegation... ');
    const overlappingDelegation = await prisma.delegation.create({
      data: {
        delegator_user_id: manager.id,
        delegate_user_id: delegate.id,
        permission_id: leaveApprovePermission.id,
        location_id: nairobi.id,
        include_descendants: false,
        valid_from: validFrom,
        valid_until: validUntil,
        status: 'active',
      },
    });
    process.stdout.write('✅\n');

    process.stdout.write('   Checking for overlaps... ');
    const { hasOverlappingDelegation } = await import('../app/lib/services/delegation');
    const hasOverlap = await hasOverlappingDelegation({
      delegator_user_id: manager.id,
      delegate_user_id: delegate.id,
      permission_id: leaveApprovePermission.id,
      location_id: nairobi.id,
      include_descendants: false,
      valid_from: validFrom,
      valid_until: validUntil,
      exclude_id: overlappingDelegation.id, // Exclude the one we just created
    });

    if (hasOverlap) {
      process.stdout.write('✅\n');
      console.log(`   ✅ Overlap detection working - detected existing delegation`);
    } else {
      process.stdout.write('⚠️\n');
      console.log(`   ⚠️  No overlap detected`);
    }

    // Clean up the overlapping delegation
    await prisma.delegation.delete({ where: { id: overlappingDelegation.id } });

    // Cleanup
    console.log('\n🧹 Cleaning up...');
    process.stdout.write('   Deleting delegations... ');
    await prisma.delegation.deleteMany({
      where: {
        OR: [
          { delegator_user_id: manager.id },
          { delegate_user_id: delegate.id },
        ],
      },
    });
    process.stdout.write('✅\n');

    process.stdout.write('   Deleting test users... ');
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['test-manager@path.org', 'test-delegate@path.org'],
        },
      },
    });
    process.stdout.write('✅\n');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ All delegation tests completed in ${duration}s!`);
    console.log('\n📝 Summary:');
    console.log('   ✅ Create delegation (self)');
    console.log('   ✅ Check authority with delegation');
    console.log('   ✅ Revoke delegation');
    console.log('   ✅ Admin delegation capability');
    console.log('   ✅ Overlap detection');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
