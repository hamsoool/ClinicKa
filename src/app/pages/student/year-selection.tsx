import { useNavigate } from 'react-router';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Lock } from 'lucide-react';
import { useAuth } from '../../lib/auth';

export default function StudentYearSelection() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const studentId = me?.student?.student_id || me?.profile.student_id || '';
  
  // Extract year from student ID/email prefix (example: 202310417)
  const enrollmentYear = studentId ? parseInt(studentId.slice(0, 4), 10) : new Date().getFullYear();
  const currentYear = new Date().getFullYear();
  const studentYearLevel = Math.min(4, Math.max(1, currentYear - enrollmentYear + 1));

  const years = [
    { level: 1, name: '1st Year', description: 'First Year Medical Examination' },
    { level: 2, name: '2nd Year', description: 'Second Year Medical Examination' },
    { level: 3, name: '3rd Year', description: 'Third Year Medical Examination' },
    { level: 4, name: '4th Year', description: 'Fourth Year Medical Examination' },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/student')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Select Year Level</h1>
          <p className="text-muted-foreground">
            Choose the academic year for your medical record submission
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Current detected level: <span className="font-semibold">{studentYearLevel}{studentYearLevel === 1 ? 'st' : studentYearLevel === 2 ? 'nd' : studentYearLevel === 3 ? 'rd' : 'th'} Year</span>
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {years.map((year) => {
            const isLocked = year.level > studentYearLevel;
            
            return (
              <Card 
                key={year.level}
                className={`cursor-pointer transition-all ${
                  isLocked 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:shadow-lg border-2 hover:border-primary'
                }`}
                onClick={() => !isLocked && navigate(`/student/medical-form/${year.level}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-semibold mb-1">{year.name}</h3>
                      <p className="text-sm text-muted-foreground">{year.description}</p>
                    </div>
                    {isLocked && (
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  {year.level === studentYearLevel && (
                    <div className="mt-3 p-2 bg-primary/10 rounded text-sm text-primary font-medium">
                      Current Year Level
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
