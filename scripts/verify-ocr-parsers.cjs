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

  const findingsPreferredResult = parsers.extractChestXrayFields(`
    CHEST X-RAY
    Findings:
    Mild bilateral perihilar interstitial opacity. No pleural effusion.
    Impression:
    Consider mild bronchitic change.
  `);

  assert.deepEqual(findingsPreferredResult, {
    findings: 'Mild bilateral perihilar interstitial opacity.\nNo pleural effusion.',
    result: 'abnormal',
  });

  const observationsHeaderResult = parsers.extractChestXrayFields(`
    CITY HOSPITAL
    CHEST XRAY
    Observations:
    Cardiomediastinal silhouette is within normal limits. No focal lung opacity.
    Conclusion:
    No acute cardiopulmonary abnormality.
  `);

  assert.deepEqual(observationsHeaderResult, {
    findings: 'Cardiomediastinal silhouette is within normal limits.\nNo focal lung opacity.',
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

  const releasedDateFields = parsers.extractUrinalysisFields(`
    BIOLINE DIAGNOSTIC LABORATORY
    PATIENT ID: 30H3TKZH8RY
    PATIENT NAME: AUREO, SEAN ROMEO
    DATE OF BIRTH: 03/13/2005
    AGE & SEX: 20 YEARS/ OLD / MALE
    RECEIVED DATE & TIME: 06/10/2025 8:49:53 AM
    RELEASED DATE & TIME: 06/10/2025 10:53:55 AM
    URINALYSIS
    TEST RESULT REF. RANGE
    Protein NEGATIVE
    Sugar NEGATIVE
  `);

  assert.equal(releasedDateFields.date, '2025-06-10');

  const collapsedHeaderFields = parsers.extractUrinalysisFields(`
    PATIENT: TEST STUDENT DATE OF BIRTH: 03/13/2005 RECEIVED DATE: 05/20/2026 RELEASED DATE: 05/24/2026
    URINALYSIS
    Protein NEGATIVE
    Glucose NEGATIVE
  `);
  assert.equal(collapsedHeaderFields.date, '2026-05-24');

  const splitLabelFields = parsers.extractUrinalysisFields(`
    ROUTINE URINALYSIS
    Date Released
    24-May-2026 02:30 PM
    DOB
    03/13/2005
    Glucose Negative
    Protein Negative
  `);
  assert.equal(splitLabelFields.date, '2026-05-24');

  const resultDateFields = parsers.extractUrinalysisFields(`
    LABORATORY RESULT
    Collection Date: 05.20.2026
    Result Date: 2026.05.24
    Sugar Negative
    Albumin Trace
  `);
  assert.equal(resultDateFields.date, '2026-05-24');

  const specimenFallbackFields = parsers.extractUrinalysisFields(`
    URINE TEST REPORT
    Birthdate: 03/13/2005
    Specimen Collected: 05/24/2026 9:00 AM
    Protein Negative
    Sugar Negative
  `);
  assert.equal(specimenFallbackFields.date, '2026-05-24');

  const issuanceDateFields = parsers.extractUrinalysisFields(`
    PATIENT: TEST STUDENT DOB: 03/13/2005 DATE OF ISSUANCE: 05/24/2026
    URINALYSIS
    Protein Negative
    Sugar Negative
  `);
  assert.equal(issuanceDateFields.date, '2026-05-24');

  const examDateFields = parsers.extractUrinalysisFields(`
    PATIENT NAME: TEST STUDENT
    BIRTHDATE: 03/13/2005
    Exam Date: 24-May-2026
    Glucose Negative
    Protein Negative
  `);
  assert.equal(examDateFields.date, '2026-05-24');

  const studyDateFields = parsers.extractUrinalysisFields(`
    PATIENT NAME: TEST STUDENT
    DOB: 03/13/2005
    Study Date
    May 24, 2026
    Protein Negative
    Glucose Negative
  `);
  assert.equal(studyDateFields.date, '2026-05-24');

  const performedDateFields = parsers.extractUrinalysisFields(`
    PATIENT NAME: TEST STUDENT
    24-05-2026
    Date Performed
    DOB: 03/13/2005
    Protein Negative
    Glucose Negative
  `);
  assert.equal(performedDateFields.date, '2026-05-24');
}

const parsers = loadParserModule();
assertExports(parsers);
verifyChestXrayParser(parsers);
verifyCbcParser(parsers);
verifyUrinalysisParser(parsers);

console.log('OCR parser verification passed.');
