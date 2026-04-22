import 'dotenv/config';
import chalk from 'chalk';
import { RedisService } from '../services/redis';

/**
 * UPSTASH DEBUG SCRIPT
 *
 * Tests local Redis/Upstash connectivity and diagnoses GET/SET issues
 * Runs 5 phases: config verification → connectivity → operations → pool stress → summary
 */

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface OperationResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  errorType?: string;
  details?: any;
}

const results: OperationResult[] = [];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function printSection(title: string): void {
  console.log(chalk.cyan('━'.repeat(70)));
  console.log(chalk.cyan.bold(`${title}`));
  console.log(chalk.cyan('━'.repeat(70)));
}

function printResult(
  label: string,
  success: boolean,
  details?: { duration?: number; info?: string; error?: string },
): void {
  const icon = success ? chalk.green('✅') : chalk.red('❌');
  let output = `${icon} ${label}`;

  if (details?.duration !== undefined) {
    output += chalk.yellow(` (⏱️  ${formatDuration(details.duration)})`);
  }
  if (details?.info) {
    output += chalk.blue(` — ${details.info}`);
  }
  if (details?.error) {
    output += chalk.red(` — ERROR: ${details.error}`);
  }

  console.log(output);
}

function maskToken(token: string): string {
  if (!token) return '(not set)';
  return `${token.substring(0, 10)}...${token.substring(token.length - 10)}`;
}

function generateTestPayload(sizeKB: number): object {
  const sizeBytes = sizeKB * 1024;
  const data = {
    timestamp: new Date().toISOString(),
    test_id: `debug_${Date.now()}`,
    payload_size_kb: sizeKB,
    fields: [] as string[],
  };

  // Fill with string data to reach approximate target size
  let currentSize = JSON.stringify(data).length;
  let counter = 0;
  while (currentSize < sizeBytes) {
    data.fields.push(`field_${counter}_${'x'.repeat(100)}`);
    currentSize = JSON.stringify(data).length;
    counter++;
  }

  return data;
}

function classifyError(error: any): string {
  const errorStr = String(error);
  const errorMessage = error?.message?.toLowerCase() || errorStr.toLowerCase();

  if (
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('forbidden') ||
    errorMessage.includes('invalid token') ||
    errorMessage.includes('401') ||
    errorMessage.includes('403')
  ) {
    return 'AUTH_ERROR';
  }

  if (
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('enotfound') ||
    errorMessage.includes('dns') ||
    errorMessage.includes('network') ||
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('too many redirects')
  ) {
    return 'NETWORK_ERROR';
  }

  if (errorMessage.includes('time') || errorMessage.includes('timeout')) {
    return 'TIMEOUT_ERROR';
  }

  if (
    errorMessage.includes('pool') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('queue')
  ) {
    return 'POOL_ERROR';
  }

  return 'UNKNOWN_ERROR';
}

function recordResult(
  name: string,
  success: boolean,
  duration: number,
  error?: string,
  errorType?: string,
  details?: any,
): void {
  results.push({
    name,
    success,
    duration,
    error,
    errorType,
    details,
  });
}

// ============================================================================
// PHASE 1: CONFIGURATION VERIFICATION
// ============================================================================

function verifyConfiguration(): boolean {
  printSection('PHASE 1: Configuration Verification');

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  const urlSet = !!url;
  const tokenSet = !!token;

  printResult('UPSTASH_REDIS_REST_URL', urlSet, {
    info: urlSet ? url?.substring(0, 50) + '...' : 'NOT SET',
  });
  printResult('UPSTASH_REDIS_REST_TOKEN', tokenSet, {
    info: tokenSet ? maskToken(token!) : 'NOT SET',
  });

  console.log(chalk.blue(`\nℹ️  Environment Info:`));
  console.log(`  Node.js: ${process.version}`);
  console.log(`  Platform: ${process.platform}`);
  console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

  if (urlSet && tokenSet) {
    console.log(chalk.green('\n✅ Configuration valid - proceeding with tests\n'));
    return true;
  } else {
    console.log(
      chalk.red('\n❌ Missing credentials - cannot proceed with tests\n'),
    );
    return false;
  }
}

// ============================================================================
// PHASE 2: BASIC CONNECTIVITY
// ============================================================================

async function testBasicConnectivity(): Promise<boolean> {
  printSection('PHASE 2: Basic Connectivity');

  try {
    const startTime = Date.now();
    const result = await RedisService.ping();
    const duration = Date.now() - startTime;

    printResult('PING Upstash', result === true, {
      duration,
      info: result === true ? 'PONG response' : 'Unexpected response',
    });

    recordResult('ping', result === true, duration);

    if (result === true) {
      console.log(chalk.green('\n✅ Connection successful\n'));
      return true;
    } else {
      console.log(chalk.red(`\n❌ Ping failed: unexpected response\n`));
      return false;
    }
  } catch (error) {
    const errorStr = String(error);
    const errorType = classifyError(error);
    printResult('PING Upstash', false, {
      error: errorStr.substring(0, 100),
    });
    recordResult('ping', false, 0, errorStr, errorType);
    console.log(chalk.red(`\n❌ Connection failed (${errorType})\n`));
    console.log(chalk.gray(`Full error: ${errorStr}\n`));
    return false;
  }
}

// ============================================================================
// PHASE 3: OPERATION TESTING
// ============================================================================

async function testOperations(): Promise<void> {
  printSection('PHASE 3: Operation Testing');

  // Test 3a: SET small payload (1KB)
  console.log(chalk.yellow('\n📝 Test 3a: SET small payload (1KB)'));
  const key1KB = `debug:test:set_small_${Date.now()}`;
  const data1KB = generateTestPayload(1);

  try {
    const startTime = Date.now();
    await RedisService.set(key1KB, data1KB, 300);
    const duration = Date.now() - startTime;

    printResult('SET small (1KB)', true, {
      duration,
      info: `Key: ${key1KB}`,
    });
    recordResult('set_small_1kb', true, duration);
  } catch (error) {
    const errorStr = String(error);
    const errorType = classifyError(error);
    printResult('SET small (1KB)', false, { error: errorStr.substring(0, 80) });
    recordResult('set_small_1kb', false, 0, errorStr, errorType);
  }

  // Test 3b: GET small payload (1KB)
  console.log(chalk.yellow('\n📝 Test 3b: GET small payload (1KB)'));
  try {
    const startTime = Date.now();
    const retrievedData = await RedisService.get<object>(key1KB);
    const duration = Date.now() - startTime;

    const success = retrievedData !== null && (retrievedData as any).test_id;
    printResult('GET small (1KB)', success, {
      duration,
      info: success ? 'Data retrieved correctly' : 'Data not found',
    });
    recordResult(
      'get_small_1kb',
      success,
      duration,
      success ? undefined : 'Data not found',
    );
  } catch (error) {
    const errorStr = String(error);
    const errorType = classifyError(error);
    printResult('GET small (1KB)', false, { error: errorStr.substring(0, 80) });
    recordResult('get_small_1kb', false, 0, errorStr, errorType);
  }

  // Test 3c: SET medium payload (100KB)
  console.log(chalk.yellow('\n📝 Test 3c: SET medium payload (100KB)'));
  const key100KB = `debug:test:set_medium_${Date.now()}`;
  const data100KB = generateTestPayload(100);
  const payload100KBSize = JSON.stringify(data100KB).length;

  try {
    const startTime = Date.now();
    await RedisService.set(key100KB, data100KB, 300);
    const duration = Date.now() - startTime;

    printResult('SET medium (100KB)', true, {
      duration,
      info: `${formatBytes(payload100KBSize)}`,
    });
    recordResult('set_medium_100kb', true, duration, undefined, undefined, {
      size: payload100KBSize,
    });
  } catch (error) {
    const errorStr = String(error);
    const errorType = classifyError(error);
    printResult('SET medium (100KB)', false, {
      error: errorStr.substring(0, 80),
    });
    recordResult('set_medium_100kb', false, 0, errorStr, errorType, {
      size: payload100KBSize,
    });
  }

  // Test 3d: GET medium payload (100KB)
  console.log(chalk.yellow('\n📝 Test 3d: GET medium payload (100KB)'));
  try {
    const startTime = Date.now();
    const retrievedData = await RedisService.get<object>(key100KB);
    const duration = Date.now() - startTime;

    const success = retrievedData !== null && (retrievedData as any).test_id;
    printResult('GET medium (100KB)', success, {
      duration,
      info: success
        ? `${formatBytes(JSON.stringify(retrievedData).length)}`
        : 'Data not found',
    });
    recordResult(
      'get_medium_100kb',
      success,
      duration,
      success ? undefined : 'Data not found',
    );
  } catch (error) {
    const errorStr = String(error);
    const errorType = classifyError(error);
    printResult('GET medium (100KB)', false, {
      error: errorStr.substring(0, 80),
    });
    recordResult('get_medium_100kb', false, 0, errorStr, errorType);
  }

  // Test 3e: DELETE operations
  console.log(chalk.yellow('\n📝 Test 3e: DELETE operations'));
  try {
    const startTime = Date.now();
    await RedisService.del(key1KB);
    await RedisService.del(key100KB);
    const duration = Date.now() - startTime;

    printResult('DELETE keys', true, { duration, info: '2 keys deleted' });
    recordResult('delete_keys', true, duration);
  } catch (error) {
    const errorStr = String(error);
    const errorType = classifyError(error);
    printResult('DELETE keys', false, { error: errorStr.substring(0, 80) });
    recordResult('delete_keys', false, 0, errorStr, errorType);
  }

  console.log();
}

// ============================================================================
// PHASE 4: CONNECTION POOL STRESS TEST
// ============================================================================

async function testPoolStress(): Promise<void> {
  printSection('PHASE 4: Connection Pool Stress Test');

  // Test 4a: Concurrent SETs (10 parallel)
  console.log(chalk.yellow('\n📊 Test 4a: 10 Concurrent SETs'));
  const setConcurrencyCount = 10;
  const setPromises: Promise<void>[] = [];
  const setTimings: number[] = [];
  let setSuccessCount = 0;
  let setFailureCount = 0;

  for (let i = 0; i < setConcurrencyCount; i++) {
    const promise = (async () => {
      const key = `debug:stress:set_${Date.now()}_${i}`;
      const data = generateTestPayload(5);

      try {
        const startTime = Date.now();
        await RedisService.set(key, data, 300);
        const duration = Date.now() - startTime;
        setTimings.push(duration);
        setSuccessCount++;
      } catch (_error) {
        console.log(_error);
        setFailureCount++;
      }
    })();
    setPromises.push(promise);
  }

  await Promise.all(setPromises);

  const setAvgTime =
    setTimings.length > 0 ? setTimings.reduce((a, b) => a + b) / setTimings.length : 0;
  const setMaxTime = setTimings.length > 0 ? Math.max(...setTimings) : 0;

  printResult(`10 Concurrent SETs`, setFailureCount === 0, {
    duration: setAvgTime,
    info: `${setSuccessCount}/${setConcurrencyCount} successful (avg ${formatDuration(setAvgTime)}, max ${formatDuration(setMaxTime)})`,
  });
  recordResult('concurrent_sets_10', setFailureCount === 0, setAvgTime, undefined, undefined, {
    success: setSuccessCount,
    total: setConcurrencyCount,
    maxDuration: setMaxTime,
  });

  // Test 4b: Concurrent GETs (10 parallel)
  console.log(chalk.yellow('\n📊 Test 4b: 10 Concurrent GETs'));
  const getConcurrencyCount = 10;
  const getPromises: Promise<void>[] = [];
  const getTimings: number[] = [];
  let getSuccessCount = 0;
  let getFailureCount = 0;

  // First populate keys
  const getKeys: string[] = [];
  for (let i = 0; i < getConcurrencyCount; i++) {
    const key = `debug:stress:get_${Date.now()}_${i}`;
    getKeys.push(key);
    const data = generateTestPayload(5);
    try {
      await RedisService.set(key, data, 300);
    } catch {
      // ignore
    }
  }

  // Then GET them in parallel
  for (const key of getKeys) {
    const promise = (async () => {
      try {
        const startTime = Date.now();
        await RedisService.get(key);
        const duration = Date.now() - startTime;
        getTimings.push(duration);
        getSuccessCount++;
      } catch (_error) {
        console.log(_error);
        getFailureCount++;
      }
    })();
    getPromises.push(promise);
  }

  await Promise.all(getPromises);

  const getAvgTime =
    getTimings.length > 0 ? getTimings.reduce((a, b) => a + b) / getTimings.length : 0;
  const getMaxTime = getTimings.length > 0 ? Math.max(...getTimings) : 0;

  printResult(`10 Concurrent GETs`, getFailureCount === 0, {
    duration: getAvgTime,
    info: `${getSuccessCount}/${getConcurrencyCount} successful (avg ${formatDuration(getAvgTime)}, max ${formatDuration(getMaxTime)})`,
  });
  recordResult('concurrent_gets_10', getFailureCount === 0, getAvgTime, undefined, undefined, {
    success: getSuccessCount,
    total: getConcurrencyCount,
    maxDuration: getMaxTime,
  });

  // Test 4c: Mixed operations (5 SET + 5 GET in parallel)
  console.log(chalk.yellow('\n📊 Test 4c: Mixed Operations (5 SET + 5 GET)'));
  const mixedPromises: Promise<void>[] = [];
  const mixedTimings: number[] = [];
  let mixedSuccessCount = 0;
  let mixedFailureCount = 0;

  // 5 SETs
  for (let i = 0; i < 5; i++) {
    const promise = (async () => {
      const key = `debug:stress:mixed_set_${Date.now()}_${i}`;
      const data = generateTestPayload(5);

      try {
        const startTime = Date.now();
        await RedisService.set(key, data, 300);
        const duration = Date.now() - startTime;
        mixedTimings.push(duration);
        mixedSuccessCount++;
      } catch (_error) {
        console.log(_error);
        mixedFailureCount++;
      }
    })();
    mixedPromises.push(promise);
  }

  // 5 GETs (populate keys first)
  const mixedGetKeys: string[] = [];
  for (let i = 0; i < 5; i++) {
    const key = `debug:stress:mixed_get_${Date.now()}_${i}`;
    mixedGetKeys.push(key);
    const data = generateTestPayload(5);
    try {
      await RedisService.set(key, data, 300);
    } catch {
      // ignore
    }
  }

  for (const key of mixedGetKeys) {
    const promise = (async () => {
      try {
        const startTime = Date.now();
        await RedisService.get(key);
        const duration = Date.now() - startTime;
        mixedTimings.push(duration);
        mixedSuccessCount++;
      } catch (_error) {
        console.log(_error);
        mixedFailureCount++;
      }
    })();
    mixedPromises.push(promise);
  }

  await Promise.all(mixedPromises);

  const mixedAvgTime =
    mixedTimings.length > 0 ? mixedTimings.reduce((a, b) => a + b) / mixedTimings.length : 0;
  const mixedMaxTime = mixedTimings.length > 0 ? Math.max(...mixedTimings) : 0;

  printResult(`5 SET + 5 GET`, mixedFailureCount === 0, {
    duration: mixedAvgTime,
    info: `${mixedSuccessCount}/10 successful (avg ${formatDuration(mixedAvgTime)}, max ${formatDuration(mixedMaxTime)})`,
  });
  recordResult('mixed_operations', mixedFailureCount === 0, mixedAvgTime, undefined, undefined, {
    success: mixedSuccessCount,
    total: 10,
    maxDuration: mixedMaxTime,
  });

  console.log();
}

// ============================================================================
// PHASE 5: DIAGNOSTICS & SUMMARY
// ============================================================================

function printSummary(): void {
  printSection('PHASE 5: Result Summary');

  console.log(chalk.blue('\n📊 Operation Results:\n'));

  // Group results by type
  const resultsByType = new Map<string, OperationResult[]>();
  for (const result of results) {
    const type = result.name.split('_')[0];
    if (!resultsByType.has(type)) {
      resultsByType.set(type, []);
    }
    resultsByType.get(type)!.push(result);
  }

  // Print table
  console.log(
    chalk.bold.cyan(
      'Operation'.padEnd(25) +
      'Status'.padEnd(10) +
      'Duration'.padEnd(12) +
      'Error Type',
    ),
  );
  console.log(chalk.cyan('─'.repeat(70)));

  let totalSuccess = 0;
  let totalFailure = 0;

  for (const result of results) {
    const status = result.success ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
    const duration = formatDuration(result.duration).padEnd(12);
    const errorType = result.errorType || '—';

    console.log(`${result.name.padEnd(25)}${status}${duration}${errorType}`);

    if (result.success) {
      totalSuccess++;
    } else {
      totalFailure++;
    }
  }

  console.log(chalk.cyan('─'.repeat(70)));

  // Summary stats
  console.log(chalk.blue('\n📈 Summary Statistics:'));
  console.log(`  Total Tests: ${results.length}`);
  console.log(chalk.green(`  Successful: ${totalSuccess}`));
  console.log(chalk.red(`  Failed: ${totalFailure}`));
  console.log(`  Success Rate: ${((totalSuccess / results.length) * 100).toFixed(1)}%`);

  // Error analysis
  const failedResults = results.filter(r => !r.success);
  if (failedResults.length > 0) {
    console.log(chalk.yellow('\n⚠️  Error Analysis:'));

    const errorTypes = new Map<string, number>();
    for (const result of failedResults) {
      const type = result.errorType || 'UNKNOWN';
      errorTypes.set(type, (errorTypes.get(type) || 0) + 1);
    }

    for (const [type, count] of errorTypes) {
      console.log(`  ${type}: ${count} occurrence(s)`);
    }
  }

  // Recommendations
  console.log(chalk.blue('\n💡 Recommendations:'));

  if (totalFailure === 0) {
    console.log(chalk.green('  ✅ All tests passed! Redis connectivity appears healthy.'));
    console.log('     No issues detected on this run.');
  } else {
    const errorTypes = new Set<string>();
    for (const result of failedResults) {
      if (result.errorType) {
        errorTypes.add(result.errorType);
      }
    }

    if (errorTypes.has('AUTH_ERROR')) {
      console.log(chalk.red('  ✗ Authentication errors detected:'));
      console.log('    - Verify UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env');
      console.log('    - Ensure credentials match your Upstash account');
      console.log('    - Compare against GitHub Secrets for prod/uat values');
    }

    if (errorTypes.has('NETWORK_ERROR')) {
      console.log(chalk.red('  ✗ Network errors detected:'));
      console.log('    - Check internet connectivity to Upstash');
      console.log('    - Verify firewall/proxy settings allow outbound HTTPS');
      console.log('    - Check DNS resolution: ping gusc1-*.upstash.io');
      console.log('    - Try: curl -i https://[UPSTASH_URL]/ping');
    }

    if (errorTypes.has('TIMEOUT_ERROR')) {
      console.log(chalk.red('  ✗ Timeout errors detected:'));
      console.log('    - Network latency may be high');
      console.log('    - Consider increasing retry timeout in Redis config');
      console.log('    - Check local network conditions');
    }

    if (errorTypes.has('POOL_ERROR')) {
      console.log(chalk.red('  ✗ Connection pool errors detected:'));
      console.log('    - Connection pool may be exhausted');
      console.log('    - Check for hanging connections in your application');
      console.log('    - Consider enabling connection pooling diagnostics');
    }

    if (errorTypes.has('UNKNOWN_ERROR')) {
      console.log(chalk.yellow('  ? Unknown errors detected:'));
      console.log('    - Review full error messages above for details');
      console.log('    - Check Upstash console for account-level issues');
    }
  }

  console.log();
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main(): Promise<void> {
  console.log(
    chalk.blue.bold(
      '\n🔍 UPSTASH CONNECTION DEBUG SCRIPT\n' +
      'Diagnosing Redis connectivity issues locally\n',
    ),
  );

  // Phase 1: Configuration
  if (!verifyConfiguration()) {
    console.log(chalk.red('\n❌ Cannot proceed without valid credentials\n'));
    process.exit(1);
  }

  // Phase 2: Connectivity
  const connected = await testBasicConnectivity();
  if (!connected) {
    console.log(
      chalk.yellow(
        '\n⚠️  Basic connectivity failed - some operations may not work\n',
      ),
    );
  }

  // Phase 3: Operations
  await testOperations();

  // Phase 4: Pool Stress
  await testPoolStress();

  // Phase 5: Summary
  printSummary();

  const failedResults = results.filter(r => !r.success);
  if (failedResults.length === 0) {
    console.log(chalk.green('\n✅ Debug complete - No issues detected\n'));
    process.exit(0);
  } else {
    console.log(chalk.yellow(`\n⚠️  Debug complete - ${failedResults.length} issue(s) detected\n`));
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(chalk.red('\n❌ Script failed with fatal error:\n'), error);
  process.exit(1);
});
