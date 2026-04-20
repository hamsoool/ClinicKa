import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../lib/auth';

export default function StudentProfile() {
  const { me } = useAuth();
  const student = me?.student;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Profile</h1>
        <p className="text-muted-foreground">Review your information from the Supabase student profile</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Student Information</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="studentId">Student ID</Label>
              <Input id="studentId" value={student?.student_id || me?.profile.student_id || ''} readOnly />
            </div>
            <div>
              <Label htmlFor="course">Course / Department</Label>
              <Input id="course" value={student?.course || me?.profile.course || ''} readOnly />
            </div>
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" value={student?.first_name || me?.profile.first_name || ''} readOnly />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" value={student?.last_name || me?.profile.last_name || ''} readOnly />
            </div>
            <div>
              <Label htmlFor="birthday">Birthday</Label>
              <Input id="birthday" value={student?.birthday || ''} readOnly />
            </div>
            <div>
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input id="contactNumber" value={student?.contact_number || ''} readOnly />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={student?.address || ''} readOnly />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
