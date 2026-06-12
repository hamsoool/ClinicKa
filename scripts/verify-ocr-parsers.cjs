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
    date: null,
    findings: 'No active pulmonary disease',
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
    date: null,
    findings: null,
    result: null,
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
    date: null,
    findings: 'No acute cardiopulmonary abnormality',
    result: 'normal',
  });

  const xrayDateResult = parsers.extractChestXrayFields(`
    CHEST X-RAY
    JUN 10, 2025
    Impression:
    Normal chest.
  `);

  assert.deepEqual(xrayDateResult, {
    date: '2025-06-10',
    findings: 'Normal chest',
    result: 'normal',
  });

  const biolineGenericDateResult = parsers.extractChestXrayFields(`
    BIOLINE DIAGNOSTIC LABORATORY & MEDICAL CLINIC
    Case# O-210150 Date: JUNE 10, 2025
    Name: AUREO, SEAN ROMEO AGE/SEX: 20M
    Examination: CHEST PA History: PE
    Lungfields are clear.
    Heart is unenlarged.
    BT and sinuses are negative.
    No other remarkable findings.
    IMPRESSION: ESSENTIALLY NORMAL CHEST FINDINGS.
  `);

  assert.deepEqual(biolineGenericDateResult, {
    date: '2025-06-10',
    findings: 'ESSENTIALLY NORMAL CHEST FINDINGS',
    result: 'normal',
  });
}

function verifyCbcParser(parsers) {
  const fields = parsers.extractCbcFields(`
    CBC RESULT
    DATE OF BIRTH: 03/13/2005
    Released Date: 05/24/2026
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

  const convertedUnitFields = parsers.extractCbcFields(`
    CBC RESULT
    DATE OF BIRTH: 03/13/2005
    RELEASED DATE & TIME: 06/10/2025 10:53:55 AM
    HGB : 13.5 g/dL
    HCT : 42 %
    WBC : 7,800 /uL
    PLATELET COUNT : 250,000 /uL
    ABO/RH : O POSITIVE
  `);

  assert.deepEqual(convertedUnitFields, {
    hemoglobin: '13.5',
    hematocrit: '42',
    wbc: '7.8',
    plateletCount: '250',
    bloodType: 'O+',
    date: '2025-06-10',
  });

  const monthNameDateFields = parsers.extractCbcFields(`
    CBC RESULT
    DATE OF BIRTH: March 13, 2005
    RELEASED DATE & TIME: Wednesday, February 28, 2026 10:53:55 AM
    HGB : 13.5 g/dL
    HCT : 42 %
  `);

  assert.deepEqual(monthNameDateFields, {
    hemoglobin: '13.5',
    hematocrit: '42',
    date: '2026-02-28',
  });

  const fullMonthDateFields = parsers.extractCbcFields(`
    CBC RESULT
    BIRTHDATE: June 10, 2005
    Date Released: June 10, 2026
    Hemoglobin 13.5 g/dL
  `);

  assert.deepEqual(fullMonthDateFields, {
    date: '2026-06-10',
    hemoglobin: '13.5',
  });

  const incompleteNamedDateFields = parsers.extractCbcFields(`
    CBC RESULT
    BIRTHDATE: June 10, 2005
    Released Date: Aug 12
    Hemoglobin 13.5 g/dL
  `);

  assert.deepEqual(incompleteNamedDateFields, {
    hemoglobin: '13.5',
  });

  const leadingDecimalFields = parsers.extractCbcFields(`
    CBC RESULT
    RELEASED DATE: 05/24/2026
    HCT .42 L/L
    WBC .50 x10^9/L
  `);

  assert.deepEqual(leadingDecimalFields, {
    hematocrit: '42',
    wbc: '0.5',
    date: '2026-05-24',
  });

  const strictFailureFields = parsers.extractCbcFields(`
    CBC RESULT
    RELEASED DATE: 05/24/2026
    HGB 13..5
    Hematocrit forty two
    Platelet Count 250O
    Blood Type 0+
  `);

  assert.deepEqual(strictFailureFields, {
    date: '2026-05-24',
  });

  const biolineBloodTypingFields = parsers.extractCbcFields(`
    HEMATOLOGY
    Hemoglobin 155.00 g/L
    Hematocrit 0.47
    WBC COUNT 9.63 x10^9/L
    Platelet Count 335.00 x10^9/L
    Blood Typing
    Blood Typing with RH        O+
    End of Report
  `);

  assert.equal(biolineBloodTypingFields.bloodType, 'O+');

  const splitBloodTypingFields = parsers.extractCbcFields(`
    HEMATOLOGY
    Blood Typing
    Blood Typing with RH
    O+
    End of Report
  `);

  assert.deepEqual(splitBloodTypingFields, {
    bloodType: 'O+',
  });

  const reorderedBloodTypingFields = parsers.extractCbcFields(`
    HEMATOLOGY
    Blood Typing
    Blood Typing with RH
    End of Report
    O+
  `);

  assert.deepEqual(reorderedBloodTypingFields, {
    bloodType: 'O+',
  });
}

function verifyUrinalysisParser(parsers) {
  const fields = parsers.extractUrinalysisFields(`
    URINALYSIS
    Received Date: 05/24/2026
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

  const fullMonthNameDateFields = parsers.extractUrinalysisFields(`
    BIOLINE DIAGNOSTIC LABORATORY
    DATE OF BIRTH: January 13, 2005
    RECEIVED DATE & TIME: Monday, March 03, 2025 8:49:53 AM
    RELEASED DATE & TIME: March 04, 2025 10:53:55 AM
    URINALYSIS
    Protein NEGATIVE
    Sugar NEGATIVE
  `);
  assert.deepEqual(fullMonthNameDateFields, {
    date: '2025-03-04',
    glucose: 'Negative',
    protein: 'Negative',
  });

  const realLayoutFields = parsers.extractUrinalysisFields(`
    BIOLINE DIAGNOSTIC LABORATORY
    PATIENT ID: 30H3TKZH8RY
    PATIENT NAME: AUREO, SEAN ROMEO
    DATE OF BIRTH: 03/13/2005
    AGE & SEX: 20 YEAR/S OLD / MALE
    RECEIVED DATE & TIME: 06/10/2025 8:49:53 AM
    RELEASED DATE & TIME: 06/10/2025 10:53:55 AM
    URINALYSIS
    TEST RESULT REF. RANGE
    PHYSICAL EXAMINATION
    Color YELLOW
    Transparency SLIGHTLY TURBID
    CHEMICAL EXAMINATION
    Protein NEGATIVE NEGATIVE
    Sugar NEGATIVE NEGATIVE
    Ketones NEGATIVE NEGATIVE
  `);
  assert.deepEqual(realLayoutFields, {
    date: '2025-06-10',
    glucose: 'Negative',
    protein: 'Negative',
  });

  const strictUrinalysisFields = parsers.extractUrinalysisFields(`
    LABORATORY RESULT
    Date: 05/24/2026
    Birthdate: 03/13/2005
    Sugar NIL
    Albumin +/-
  `);
  assert.deepEqual(strictUrinalysisFields, {
    date: null,
    glucose: null,
    protein: null,
  });

  const conflictingUrinalysisFields = parsers.extractUrinalysisFields(`
    URINALYSIS
    Released Date: January 2026
    Glucose Negative Trace
    Protein Negative
  `);
  assert.deepEqual(conflictingUrinalysisFields, {
    date: null,
    glucose: null,
    protein: 'Negative',
  });

  const plusValueFields = parsers.extractUrinalysisFields(`
    URINALYSIS
    RELEASED DATE: 05/24/2026
    Glucose +1
    Protein 2+
  `);
  assert.deepEqual(plusValueFields, {
    date: '2026-05-24',
    glucose: '1+',
    protein: '2+',
  });
}

const parsers = loadParserModule();
assertExports(parsers);
verifyChestXrayParser(parsers);
verifyCbcParser(parsers);
verifyUrinalysisParser(parsers);

console.log('OCR parser verification passed.');
