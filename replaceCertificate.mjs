import fs from 'fs';

let content = fs.readFileSync('src/app/pages/student/certificate.tsx', 'utf8');

// Replace imports
content = content.replace(
  "import { useEffect, useRef, useState } from 'react';",
  "import { useEffect, useRef } from 'react';\nimport { useQuery } from '@tanstack/react-query';"
);

// Replace state and load function
const targetRegex = /const \[record, setRecord\] = useState<MockSubmission \| null>\(null\);\s+const \[loading, setLoading\] = useState\(true\);\s+const clearanceRef = useRef<HTMLDivElement>\(null\);\s+useEffect\(\(\) => \{\s+loadStudentRecord\(\);\s+\}, \[\]\);\s+const loadStudentRecord = \(\) => \{[\s\S]*?\};\s+/m;

const replacement = `const clearanceRef = useRef<HTMLDivElement>(null);

  const { data: record, isLoading: loading, isError } = useQuery({
    queryKey: ['studentRecords'],
    queryFn: async () => {
      const data = await getStudentRecords();
      const records = data.records || [];
      const approvedCertificate =
        records.find((entry) => entry.status === 'approved' && entry.clearanceInfo?.controlNo) ||
        records.find((entry) => entry.status === 'approved') ||
        null;
      return approvedCertificate || records[0] || null;
    }
  });

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load certificate');
    }
  }, [isError]);

  `;

content = content.replace(targetRegex, replacement);

fs.writeFileSync('src/app/pages/student/certificate.tsx', content);
