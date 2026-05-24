const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

global.Deno = {
  env: {
    get: () => '',
  },
};

const root = path.resolve(__dirname, '..');
const parserPath = path.join(root, 'supabase/functions/server/ocr-space-ocr.ts');
const code = esbuild.transformSync(fs.readFileSync(parserPath, 'utf8'), {
  format: 'cjs',
  loader: 'ts',
}).code;
const moduleObject = { exports: {} };

new Function('exports', 'require', 'module', '__filename', '__dirname', code)(
  moduleObject.exports,
  require,
  moduleObject,
  parserPath,
  path.dirname(parserPath),
);

const {
  extractCbcFields,
  extractChestXrayFields,
  extractUrinalysisFields,
} = moduleObject.exports;

function assertXray(name, rawText, expected) {
  const actual = extractChestXrayFields(rawText);
  assert.deepEqual(actual, expected, name);
}

function assertCbc(name, rawText, expected) {
  const actual = extractCbcFields(rawText);
  assert.deepEqual(actual, expected, name);
}

function assertUrinalysis(name, rawText, expected) {
  const actual = extractUrinalysisFields(rawText);
  assert.deepEqual(actual, expected, name);
}

assertXray(
  'xray impression stops before signature block',
  `RADIOGRAPHIC REPORT
Both lungs are clear.
Heart is not enlarged.
Diaphragm and sulci are intact.
The visualized bones are unremarkable.

IMPRESSION:
ESSENTIALLY NORMAL CHEST FINDINGS.

SHERLYN MAE V. RAMIREZ, RRT
Rad. Tech.
MINDA F. MAPALAD,MD, FPCR
Radiologist
Note: This report is based entirely on roentgenographic examination and should be correlated with clinical and laboratory findings.
Page 1 of 1`,
  {
    findings: 'ESSENTIALLY NORMAL CHEST FINDINGS.',
    result: 'normal',
  },
);

assertXray(
  'xray flattened impression stops before credentials',
  'IMPRESSION: ESSENTIALLY NORMAL CHEST. SHERLYN MAE V. RAMIREZ, RRT Rad. Tech. MINDA F. MAPALAD,MD, FPCR',
  {
    findings: 'ESSENTIALLY NORMAL CHEST.',
    result: 'normal',
  },
);

assertXray(
  'xray ignores generated observations after impression',
  `Findings:
There are low lung volumes with an appearance of bronchovascular crowding.

Impression:
Mild pulmonary edema.

Observations:
Cardiomegaly, Lung Opacity, Atelectasis.
MeSH Tags:
Pulmonary Atelectasis, Lung, Heart, Edema.`,
  {
    findings: 'Mild pulmonary edema.',
    result: 'abnormal',
  },
);

assertXray(
  'xray conclusion template',
  `CHEST PA
CONCLUSION:
NO ACTIVE PULMONARY DISEASE.
Verified by Juan Dela Cruz, MD`,
  {
    findings: 'NO ACTIVE PULMONARY DISEASE.',
    result: 'normal',
  },
);

assertXray(
  'xray interpretation template',
  `Radiologic Interpretation:
Minimal PTB, right upper lobe.
Prepared by: Diagnostic Center`,
  {
    findings: 'Minimal PTB, right upper lobe.',
    result: 'abnormal',
  },
);

assertCbc(
  'cbc standard row labels',
  `Complete Blood Count
Date: 05/25/2026
Hemoglobin 13.5 g/dL 12.0 - 16.0
Hematocrit 40.2 % 37 - 47
White Blood Cell Count 7.8 x10^9/L 4.5 - 10.0
Platelet Count 250 x10^9/L 150 - 450
Blood Type O+`,
  {
    date: '2026-05-25',
    hemoglobin: '13.5',
    hematocrit: '40.2',
    wbc: '7.8',
    plateletCount: '250',
    bloodType: 'O+',
  },
);

assertCbc(
  'cbc SI and per microliter units',
  `CBC RESULT
Collected
25 May 2026
Hb: 135 g/L
Hct: 0.402 L/L
WBC: 7,800 /uL
PLT: 250,000 /uL
ABO: A
Rh: Positive`,
  {
    date: '2026-05-25',
    hemoglobin: '13.5',
    hematocrit: '40.2',
    wbc: '7.8',
    plateletCount: '250',
    bloodType: 'A+',
  },
);

assertCbc(
  'cbc compact table values with units',
  `Hemoglobin Hematocrit WBC Platelet Count
13.5 g/dL 40.2 % 7.8 x10^9/L 250 x10^9/L`,
  {
    hemoglobin: '13.5',
    hematocrit: '40.2',
    wbc: '7.8',
    plateletCount: '250',
  },
);

assertCbc(
  'cbc alternate unit labels',
  `HGB 13.5 g/dL
PCV 40.2 %
TLC 7.8 K/uL
Thrombocyte Count 250 10^3/mm3
Blood Group: B Rh(D) Negative`,
  {
    hemoglobin: '13.5',
    hematocrit: '40.2',
    wbc: '7.8',
    plateletCount: '250',
    bloodType: 'B-',
  },
);

assertCbc(
  'cbc avoids ambiguous count conversion',
  `Hb 135
Hct 0.402
WBC 7800
PLT 250000`,
  {
    hematocrit: '40.2',
  },
);

assertUrinalysis(
  'urinalysis standard labeled rows',
  `URINALYSIS
Date: 05/25/2026
Color Yellow
Transparency Clear
Glucose Negative
Protein Trace
pH 6.0`,
  {
    date: '2026-05-25',
    glucose: 'Negative',
    protein: 'Trace',
  },
);

assertUrinalysis(
  'urinalysis plus values',
  `ROUTINE URINE EXAMINATION
Collected
25 May 2026
Urine Glucose: ++
Albumin: 1+
Medical Technologist: SAMPLE NAME, RMT`,
  {
    date: '2026-05-25',
    glucose: '2+',
    protein: '1+',
  },
);

assertUrinalysis(
  'urinalysis compact dipstick table',
  `Parameter Glucose Protein pH
Result NEGATIVE 3+ 6.0`,
  {
    glucose: 'Negative',
    protein: '3+',
  },
);

assertUrinalysis(
  'urinalysis leaves numeric-only dipstick values blank',
  `Urinalysis
Glucose 100 mg/dL
Protein 30 mg/dL`,
  {},
);

console.log('OCR parser verification passed.');
