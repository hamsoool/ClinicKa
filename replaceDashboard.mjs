import fs from 'fs';

let content = fs.readFileSync('src/app/pages/student/dashboard.tsx', 'utf8');

// Replace imports
content = content.replace(
  "import { useEffect, useRef, useState } from 'react';",
  "import { useEffect, useState } from 'react';\nimport { useQuery } from '@tanstack/react-query';"
);

// Replace state and load function
const targetRegex = /const \[records, setRecords\] = useState<StudentRecord\[\]>\(\[\]\);\s+const \[loading, setLoading\] = useState\(true\);\s+const isInitialMountRef = useRef\(true\);\s+useEffect\(\(\) => \{[\s\S]*?\}, \[studentId\]\);\s+const loadRecords = async \(\) => \{[\s\S]*?\};\s+/m;

const replacement = `const { data, isLoading: loading, isError, error } = useQuery({
    queryKey: ['studentRecords', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const response = await getStudentRecords();
      return (response.records || []) as StudentRecord[];
    },
    enabled: !!studentId,
  });

  const records = data || [];

  useEffect(() => {
    if (isError && error) {
      const message = error instanceof Error ? error.message : 'Failed to load records';
      if (message.toLowerCase().includes('profile not found')) {
        toast.error('Your account is not fully set up yet. Please sign out and sign in again.');
      } else {
        toast.error(message);
      }
    }
  }, [isError, error]);

  `;

content = content.replace(targetRegex, replacement);

fs.writeFileSync('src/app/pages/student/dashboard.tsx', content);
