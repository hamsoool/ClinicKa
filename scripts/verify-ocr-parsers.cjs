#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');
const parserPath = path.join(repoRoot, 'supabase', 'functions', 'server', 'ocr-space-ocr.ts');

function loadParserModule() {
  const source = fs.readFileSync(parserPath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: parserPath,
  });

  const previousDeno = global.Deno;
  global.Deno = {
    env: {
      get: () => undefined,
    },
  };

  try {
    const parserModule = new Module(parserPath, module);
    parserModule.filename = parserPath;
    parserModule.paths = Module._nodeModulePaths(path.dirname(parserPath));
    parserModule._compile(outputText, parserPath);
    return parserModule.exports;
  } finally {
    if (previousDeno === undefined) {
      delete global.Deno;
    } else {
      global.Deno = previousDeno;
    }
  }
}

function assertExports(parsers) {
  for (const exportName of ['extractChestXrayFields', 'extractCbcFields', 'extractUrinalysisFields']) {
    assert.equal(typeof parsers[exportName], 'function', `${exportName} must be exported`);
  }
}

function verifyChestXrayParser(parsers) {
  const result = parsers.extractChestXrayFields(`
    GORDON DIAGNOSTIC CENTER
    Patient: Test Student
    CHEST X-RAY FINDINGS:
    The lungs are clear. Heart is not enlarged. No active pulmonary disease.
    Radiologist: SAMPLE MD
  `);

  assert.deepEqual(result, {
    findings: 'The lungs are clear.\nHeart is not enlarged.\nNo active pulmonary disease.',
    result: 'normal',
  });
}

function verifyCbcParser(parsers) {
  const fields = parsers.extractCbcFields(`
    CBC RESULT
    Date: 05/24/2026
    Hemoglobin 13.5 g/dL
    Hematocrit 42 %
    WBC 7.8 x10^9/L
    Platelet Count 250 x10^9/L
    Blood Type O+
  `);

  assert.deepEqual(fields, {
    hemoglobin: '13.5',
    hematocrit: '42',
    wbc: '7.8',
    plateletCount: '250',
    bloodType: 'O+',
    date: '2026-05-24',
  });
}

function verifyUrinalysisParser(parsers) {
  const fields = parsers.extractUrinalysisFields(`
    URINALYSIS
    Date: 05/24/2026
    Glucose Negative
    Protein Trace
  `);

  assert.deepEqual(fields, {
    glucose: 'Negative',
    protein: 'Trace',
    date: '2026-05-24',
  });
}

const parsers = loadParserModule();
assertExports(parsers);
verifyChestXrayParser(parsers);
verifyCbcParser(parsers);
verifyUrinalysisParser(parsers);

console.log('OCR parser verification passed.');
