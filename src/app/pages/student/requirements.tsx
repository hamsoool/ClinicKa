import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { CheckCircle } from 'lucide-react';

const requirements = [
  { label: 'Chest X-Ray', formats: ['PDF', 'PNG', 'JPG'] },
  { label: 'Complete Blood Count (CBC)', formats: ['PDF', 'PNG', 'JPG'] },
  { label: 'Urinalysis', formats: ['PDF', 'PNG', 'JPG'] },
  { label: 'Digital Signature', formats: ['PNG', 'JPG'] },
];

const checklist = [
  'Fill out personal information accurately',
  'Review medical history before submission',
  'Check lab file clarity and legibility',
  'Confirm contact and emergency details',
  'Accept the data privacy agreement',
];

export default function StudentRequirements() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Requirements</h1>
        <p className="text-muted-foreground">What you need before submitting</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Required Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {requirements.map((req) => (
              <div key={req.label} className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <p className="font-medium">{req.label}</p>
                  <p className="text-sm text-muted-foreground">Accepted formats</p>
                </div>
                <div className="flex gap-2">
                  {req.formats.map((format) => (
                    <Badge key={format} className="bg-primary/10 text-primary">
                      {format}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submission Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklist.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                <p className="text-sm">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
