import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Button } from '../../components/ui/button';

export default function AdminSystemSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary mb-2">System Settings</h1>
        <p className="text-muted-foreground">Configure clinic profile, security, and system preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinic Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="clinicName">Clinic Name</Label>
            <Input id="clinicName" defaultValue="Gordon College Health Services Unit" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinicEmail">Primary Contact Email</Label>
            <Input id="clinicEmail" type="email" defaultValue="clinic@gordoncollege.edu" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinicPhone">Contact Number</Label>
            <Input id="clinicPhone" defaultValue="+63 2 8123 4567" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinicHours">Clinic Hours</Label>
            <Input id="clinicHours" defaultValue="Mon-Fri, 8:00 AM - 5:00 PM" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="clinicAddress">Address</Label>
            <Input id="clinicAddress" defaultValue="Gordon College Campus, Olongapo City" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security and Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Require Two-Factor Authentication</p>
              <p className="text-sm text-muted-foreground">Enforce 2FA for all staff and admin accounts.</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Session Timeout</p>
              <p className="text-sm text-muted-foreground">Automatically sign out inactive users.</p>
            </div>
            <Input className="max-w-[140px]" defaultValue="30 minutes" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Audit Logging</p>
              <p className="text-sm text-muted-foreground">Track admin actions and access events.</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-Archive Graduated Records</p>
              <p className="text-sm text-muted-foreground">Move records to archive 12 months after graduation.</p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">Send alerts for approvals and re-submissions.</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Maintenance Window</p>
              <p className="text-sm text-muted-foreground">Preferred time for system updates.</p>
            </div>
            <Input className="max-w-[180px]" defaultValue="Sundays, 1:00 AM" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>Save Settings</Button>
      </div>
    </div>
  );
}
