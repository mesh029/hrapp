import 'dotenv/config';
import { prisma } from '../app/lib/db';
import { redis } from '../app/lib/redis';

async function testConnections() {
  console.log('🔍 Testing connections...\n');

  // Test Database Connection
  try {
    console.log('📊 Testing PostgreSQL connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful!\n');
  } catch (error: any) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }

  // Test Redis Connection
  try {
    console.log('🔴 Testing Redis connection...');
    const result = await redis.ping();
    if (result === 'PONG') {
      console.log('✅ Redis connection successful!\n');
    } else {
      throw new Error('Redis ping failed');
    }
  } catch (error: any) {
    console.error('❌ Redis connection failed:', error.message);
    process.exit(1);
  }

  // Test Database Query
  try {
    console.log('📝 Testing database query...');
    const userCount = await prisma.user.count();
    console.log(`✅ Database query successful! Found ${userCount} user(s)\n`);
  } catch (error: any) {
    console.error('❌ Database query failed:', error.message);
    process.exit(1);
  }

  // Test Redis Set/Get
  try {
    console.log('💾 Testing Redis operations...');
    await redis.set('test:connection', 'success', 'EX', 10);
    const value = await redis.get('test:connection');
    if (value === 'success') {
      console.log('✅ Redis operations successful!\n');
    } else {
      throw new Error('Redis value mismatch');
    }
  } catch (error: any) {
    console.error('❌ Redis operations failed:', error.message);
    process.exit(1);
  }

  console.log('🎉 All connection tests passed!');
  await prisma.$disconnect();
  redis.disconnect();
}

testConnections();
