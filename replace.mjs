import fs from 'fs';
let c = fs.readFileSync('src/app/pages/student/records.tsx', 'utf8');
c = c.replace(/const \[records, setRecords\] = useState<MockSubmission\[\]>\(\[\]\);[\s\S]*?loadRecords\(\);\s*}, \[\]\);/m, 
`const { data, isLoading: loading, isError } = useQuery({
    queryKey: ['studentRecords'],
    queryFn: async () => {
      const response = await getStudentRecords();
      return response.records || [];
    }
  });

  const records = data || [];

  if (isError) {
    toast.error('Failed to load records');
  }`);
fs.writeFileSync('src/app/pages/student/records.tsx', c);
