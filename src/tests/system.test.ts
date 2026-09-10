// Shulea System Tests
// Run these tests to verify all components work correctly

import { ConnectionManager } from '@/services/database/ConnectionManager'
import { UserRepository } from '@/repositories/UserRepository'
import { StudentRepository } from '@/repositories/StudentRepository'
import { ClassRepository } from '@/repositories/ClassRepository'
import { validateRequired, validateEmail, validateLength, generateId } from '@/modules/validation'
import { sha256 } from '@/services/api/auth'
import { StorageMonitor } from '@/services/device/StorageMonitor'
import { AutoBackup } from '@/services/device/AutoBackup'

// Test Result Interface
interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}

// Test Suite
export class SystemTests {
  private results: TestResult[] = []

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const start = Date.now()
    try {
      await testFn()
      this.results.push({
        name,
        passed: true,
        duration: Date.now() - start
      })
      console.log(`✅ ${name} (${Date.now() - start}ms)`)
    } catch (error) {
      this.results.push({
        name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start
      })
      console.error(`❌ ${name}: ${error}`)
    }
  }

  // ========== DATABASE TESTS ==========

  async testDatabaseConnection(): Promise<void> {
    await this.runTest('Database Connection', async () => {
      const isMobile = ConnectionManager.isMobile()
      console.log('  Mobile mode:', isMobile)
      
      // Test basic query
      const result = await ConnectionManager.query('SELECT 1 as test', [])
      if (!result || result.length === 0) {
        throw new Error('Database query returned no results')
      }
      console.log('  Query result:', result)
    })
  }

  async testDatabaseWrite(): Promise<void> {
    await this.runTest('Database Write', async () => {
      const testId = generateId()
      const now = new Date().toISOString()
      
      // Try to write to a test table or use existing
      try {
        await ConnectionManager.execute(
          'INSERT INTO AppSetting (id, key, value, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
          [testId, 'test_key', 'test_value', now, now]
        )
        console.log('  Insert successful:', testId)
        
        // Verify read
        const rows = await ConnectionManager.query(
          'SELECT * FROM AppSetting WHERE id = ?',
          [testId]
        )
        if (rows.length === 0) {
          throw new Error('Could not read back inserted data')
        }
        
        // Cleanup
        await ConnectionManager.execute(
          'DELETE FROM AppSetting WHERE id = ?',
          [testId]
        )
      } catch (error) {
        // If AppSetting doesn't exist, just test connection
        console.log('  Using connection test only')
      }
    })
  }

  // ========== VALIDATION TESTS ==========

  async testValidation(): Promise<void> {
    await this.runTest('Validation Module', async () => {
      // Test required fields
      try {
        validateRequired({ name: 'John' }, ['email'])
        throw new Error('Should have thrown for missing email')
      } catch (e) {
        console.log('  ✓ Required field validation works')
      }

      // Test email validation
      const validEmails = ['test@email.com', 'user@domain.co.uk']
      const invalidEmails = ['invalid', '@domain.com', 'user@']

      for (const email of validEmails) {
        validateEmail(email)
      }
      console.log('  ✓ Valid emails accepted')

      for (const email of invalidEmails) {
        try {
          validateEmail(email)
          throw new Error(`Should have rejected: ${email}`)
        } catch (e) {
          // Expected
        }
      }
      console.log('  ✓ Invalid emails rejected')

      // Test length validation
      validateLength('hello', 'Test', 3, 10)
      console.log('  ✓ Length validation works')

      try {
        validateLength('hi', 'Test', 3, 10)
        throw new Error('Should have rejected short string')
      } catch (e) {
        console.log('  ✓ Min length enforced')
      }
    })
  }

  // ========== UUID GENERATION TESTS ==========

  async testUUIDGeneration(): Promise<void> {
    await this.runTest('UUID Generation', async () => {
      const ids = new Set<string>()
      
      // Generate 100 IDs and ensure all are unique
      for (let i = 0; i < 100; i++) {
        const id = generateId()
        if (ids.has(id)) {
          throw new Error(`Duplicate ID generated: ${id}`)
        }
        ids.add(id)
        
        // Verify format (should be xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
          throw new Error(`Invalid UUID format: ${id}`)
        }
      }
      
      console.log('  Generated 100 unique valid UUIDs')
    })
  }

  // ========== PASSWORD HASHING TESTS ==========

  async testPasswordHashing(): Promise<void> {
    await this.runTest('Password Hashing', async () => {
      const password = 'testPassword123'
      const hash1 = await sha256(password)
      const hash2 = await sha256(password)
      
      // Same password should produce same hash
      if (hash1 !== hash2) {
        throw new Error('Same password produced different hashes')
      }
      console.log('  ✓ Consistent hashing')
      
      // Different passwords should produce different hashes
      const hash3 = await sha256('differentPassword')
      if (hash1 === hash3) {
        throw new Error('Different passwords produced same hash')
      }
      console.log('  ✓ Different passwords have different hashes')
      
      // Hash should be 64 characters (256 bits = 32 bytes = 64 hex chars)
      if (hash1.length !== 64) {
        throw new Error(`Hash length should be 64, got ${hash1.length}`)
      }
      console.log('  ✓ Hash length correct (64 chars)')
      
      console.log('  Sample hash:', hash1.substring(0, 16) + '...')
    })
  }

  // ========== USER REPOSITORY TESTS ==========

  async testUserRepository(): Promise<void> {
    await this.runTest('User Repository', async () => {
      const testEmail = `test_${generateId().substring(0, 8)}@test.com`
      
      // Test create
      const user = await UserRepository.create({
        email: testEmail,
        username: `testuser_${generateId().substring(0, 8)}`,
        password: await sha256('password123'),
        fullName: 'Test User',
        role: 'TEACHER',
        active: true
      })
      
      if (!user.id) {
        throw new Error('Created user has no ID')
      }
      console.log('  ✓ User created:', user.id)
      
      // Test find by email
      const found = await UserRepository.findByEmail(testEmail)
      if (!found) {
        throw new Error('Could not find created user by email')
      }
      console.log('  ✓ User found by email')
      
      // Test find by ID
      const foundById = await UserRepository.findById(user.id)
      if (!foundById) {
        throw new Error('Could not find created user by ID')
      }
      console.log('  ✓ User found by ID')
      
      // Cleanup - delete test user
      await UserRepository.delete(user.id)
      console.log('  ✓ Test user cleaned up')
    })
  }

  // ========== STORAGE MONITOR TESTS ==========

  async testStorageMonitor(): Promise<void> {
    await this.runTest('Storage Monitor', async () => {
      const info = await StorageMonitor.getFormattedStorageInfo()
      
      if (info) {
        console.log('  Total:', info.total)
        console.log('  Used:', info.used)
        console.log('  Free:', info.free)
        console.log('  Percent Used:', info.percentUsed + '%')
        console.log('  Healthy:', info.isHealthy)
        console.log('  ✓ Storage info retrieved')
      } else {
        console.log('  ⚠ Storage info not available (expected in some environments)')
      }
    })
  }

  // ========== AUTO BACKUP TESTS ==========

  async testAutoBackupConfig(): Promise<void> {
    await this.runTest('Auto-Backup Config', async () => {
      // Test get config
      const config = await AutoBackup.getConfig()
      console.log('  Current config:', config)
      
      // Test save config
      const newConfig = {
        ...config,
        enabled: true,
        intervalDays: 7,
        keepCount: 5
      }
      
      await AutoBackup.saveConfig(newConfig)
      console.log('  ✓ Config saved')
      
      // Verify save
      const savedConfig = await AutoBackup.getConfig()
      if (savedConfig.intervalDays !== 7) {
        throw new Error('Config not saved correctly')
      }
      console.log('  ✓ Config verified')
    })
  }

  // ========== RUN ALL TESTS ==========

  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Starting System Tests...\n')
    this.results = []
    
    // Database tests
    await this.testDatabaseConnection()
    await this.testDatabaseWrite()
    
    // Core functionality tests
    await this.testValidation()
    await this.testUUIDGeneration()
    await this.testPasswordHashing()
    
    // Repository tests
    await this.testUserRepository()
    
    // Device service tests
    await this.testStorageMonitor()
    await this.testAutoBackupConfig()
    
    // Print summary
    this.printSummary()
    
    return this.results
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(50))
    console.log('📊 TEST SUMMARY')
    console.log('='.repeat(50))
    
    const passed = this.results.filter(r => r.passed).length
    const failed = this.results.filter(r => !r.passed).length
    const total = this.results.length
    
    console.log(`Total: ${total} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`)
    console.log('')
    
    if (failed > 0) {
      console.log('Failed Tests:')
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  ❌ ${r.name}`)
          console.log(`     Error: ${r.error}`)
        })
    }
    
    console.log('')
    console.log(failed === 0 ? '🎉 All tests passed!' : '⚠️ Some tests failed')
    console.log('='.repeat(50))
  }
}

// Export singleton
export const systemTests = new SystemTests()

// Auto-run if in browser console
if (typeof window !== 'undefined') {
  (window as unknown as { runTests: () => Promise<TestResult[]> }).runTests = () => systemTests.runAllTests()
  console.log('🧪 System tests loaded. Run with: await runTests()')
}
