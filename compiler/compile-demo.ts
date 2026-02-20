/**
 * Demo script to compile a layout specification
 * 
 * Run with: npx tsx src/layout/compile-demo.ts <input-file> <output-file>
 * 
 * Example:
 *   npx tsx src/layout/compile-demo.ts src/examples/script-ac-1-part-1-layout.json output/compiled-part-1.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { compileLayout } from './index';
import { LayoutSpec } from './types';

// Parse command-line arguments
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.error('Usage: npx tsx src/layout/compile-demo.ts <input-file> <output-file>');
  console.error('');
  console.error('Example:');
  console.error('  npx tsx src/layout/compile-demo.ts src/examples/script-ac-1-part-1-layout.json output/compiled-part-1.json');
  process.exit(1);
}

const specPath = args[0];
const outputPath = args[1];

// Validate input file exists
if (!fs.existsSync(specPath)) {
  console.error(`Error: Input file not found: ${specPath}`);
  process.exit(1);
}

// Ensure output directory exists
const outputDir = path.dirname(outputPath);
if (outputDir && !fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read the layout spec
const specContent = fs.readFileSync(specPath, 'utf-8');
const spec: LayoutSpec = JSON.parse(specContent);

console.log('='.repeat(60));
console.log('Layout Compiler Demo');
console.log('='.repeat(60));
console.log(`\nInput: ${specPath}`);
console.log(`Title: ${spec.meta.title}`);
console.log(`Scenes: ${spec.scenes.length}`);
console.log(`Resolution: ${spec.meta.resolution.width}x${spec.meta.resolution.height}`);

// Compile
console.log('\nCompiling...\n');
const project = compileLayout(spec);

// Output statistics
console.log('Compilation Results:');
console.log('-'.repeat(40));
console.log(`Total Duration: ${project.meta.duration}s`);
console.log(`Scenes compiled: ${project.scenes.length}`);

for (const scene of project.scenes) {
  console.log(`\n  Scene: ${scene.name}`);
  console.log(`    Start: ${scene.startTime}s, Duration: ${scene.duration}s`);
  console.log(`    Actions: ${scene.actions.length}`);
  
  for (const action of scene.actions) {
    if (action.type === 'audio') {
      console.log(`      - audio: ${action.assetId}`);
    } else if (action.type === 'svgAnimation') {
      console.log(`      - svg: ${action.assetId} at (${action.x}, ${action.y}) scale=${action.scale.toFixed(2)}`);
    } else if (action.type === 'text') {
      console.log(`      - text: "${action.text}" at (${action.x}, ${action.y})`);
    } else if (action.type === 'shape') {
      if ('x2' in action && action.x2 !== undefined) {
        console.log(`      - ${action.shape}: (${action.x}, ${action.y}) → (${action.x2}, ${action.y2})`);
      } else {
        console.log(`      - ${action.shape} at (${action.x}, ${action.y})`);
      }
    } else if (action.type === 'image') {
      console.log(`      - image: ${action.assetId} at (${action.x}, ${action.y}) ${action.width}x${action.height}`);
    }
  }
}

// Write output to file
fs.writeFileSync(outputPath, JSON.stringify(project, null, 2));
console.log(`\n${'='.repeat(60)}`);
console.log(`Output written to: ${outputPath}`);
console.log('='.repeat(60));
