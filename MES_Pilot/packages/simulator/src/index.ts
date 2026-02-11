/**
 * CLI entry point for the MES Plant Simulator.
 *
 * Usage:
 *   npx tsx src/index.ts --scenario normal-day
 *   npx tsx src/index.ts --scenario normal-day --api-url http://localhost:3000
 */

import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SimulationConfig, SimEvent } from './types.js';
import { ProductionSimulator } from './equipment/production-simulator.js';
import { MesClient } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadScenario(name: string): Promise<SimulationConfig> {
  const filePath = join(__dirname, 'scenarios', `${name}.json`);
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as SimulationConfig;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      scenario: { type: 'string', short: 's' },
      'api-url': { type: 'string', short: 'a' },
      email: { type: 'string', short: 'e', default: 'simulator@mes.local' },
      'area-id': { type: 'string', default: 'AREA-01' },
    },
    strict: true,
  });

  const scenarioName = values.scenario;
  if (!scenarioName) {
    console.error('Usage: npx tsx src/index.ts --scenario <name> [--api-url <url>]');
    console.error('Available scenarios: normal-day, bad-batch, unreliable-line');
    process.exit(1);
  }

  console.log(`Loading scenario: ${scenarioName}`);
  const config = await loadScenario(scenarioName);
  console.log(`Scenario "${config.name}" loaded: ${config.lines.length} line(s), ${config.workOrders.length} work order(s)`);
  console.log(`Shift duration: ${config.shiftDurationHours}h, Time scale: ${config.timeScale}x`);
  console.log('');

  // Connected mode: set up MES client
  let mesClient: MesClient | undefined;
  if (values['api-url']) {
    mesClient = new MesClient(values['api-url']);
    console.log(`Connecting to MES at ${values['api-url']}...`);
    await mesClient.login(values.email!);
    console.log('Logged in to MES.');
    console.log('');
  }

  const simulator = new ProductionSimulator(config);

  // Set up event logging
  const eventTypeCounts = new Map<string, number>();

  simulator.engine.on('*', async (event: SimEvent) => {
    eventTypeCounts.set(event.type, (eventTypeCounts.get(event.type) ?? 0) + 1);

    switch (event.type) {
      case 'wo-start':
        console.log(`[${formatTime(event.time)}] Work order started`);
        break;
      case 'good-unit': {
        const produced = event.data.produced as number;
        if (produced % 500 === 0) {
          console.log(`[${formatTime(event.time)}] Produced: ${produced} units`);
        }
        if (mesClient && event.data.workOrderId) {
          await mesClient.logProduction(
            event.data.workOrderId as string,
            'good-unit',
            1
          ).catch((err) => console.error(`  MES API error: ${err}`));
        }
        break;
      }
      case 'reject':
        console.log(`[${formatTime(event.time)}] REJECT on ${event.data.workOrderId}`);
        if (mesClient && event.data.workOrderId) {
          await mesClient.logProduction(
            event.data.workOrderId as string,
            'reject',
            1,
            'quality-defect'
          ).catch((err) => console.error(`  MES API error: ${err}`));
        }
        break;
      case 'breakdown-start':
        console.log(
          `[${formatTime(event.time)}] BREAKDOWN on ${event.data.workOrderId} ` +
            `(repair ~${Math.round((event.data.repairDurationSec as number) / 60)}min)`
        );
        break;
      case 'repair-complete':
        console.log(`[${formatTime(event.time)}] Repair complete, resuming production`);
        break;
      case 'minor-stop':
        console.log(
          `[${formatTime(event.time)}] Minor stop on ${event.data.workOrderId} ` +
            `(${Math.round(event.data.durationSec as number)}s)`
        );
        break;
      case 'wo-complete':
        console.log(`[${formatTime(event.time)}] Work order COMPLETE`);
        if (mesClient) {
          const woId = event.data.workOrderId as string | undefined;
          if (woId) {
            await mesClient.completeWorkOrder(woId)
              .catch((err) => console.error(`  MES API error: ${err}`));
          }
        }
        break;
    }
  });

  console.log('--- Simulation Start ---');
  console.log('');

  const events = await simulator.run();

  console.log('');
  console.log('--- Simulation Complete ---');
  console.log('');

  // Summary
  const summary = simulator.getSummary();
  for (const wo of summary) {
    console.log(`Work Order: ${wo.workOrderId}`);
    console.log(`  Product: ${wo.productSku}`);
    console.log(`  Target: ${wo.targetQty} | Produced: ${wo.produced} | Rejected: ${wo.rejected}`);
    console.log(`  Completed: ${wo.completed ? 'Yes' : 'No'}`);
  }
  console.log('');
  console.log('Event counts:');
  for (const [type, count] of [...eventTypeCounts.entries()].sort()) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(`Total events: ${events.length}`);
}

main().catch((err) => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
