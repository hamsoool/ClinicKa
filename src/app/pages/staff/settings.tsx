import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Settings as SettingsIcon, Bell, User, Shield } from 'lucide-react';
import { useState } from 'react';

export default function StaffSettings() {
  const [profile, setProfile] = useState({
    name: 'Dr. Andrea Salonga',
    email: 'asalonga@gordoncollege.edu.ph',
    position: 'Clinic Physician',
    phone: '0917 555 2040',
  });
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    pendingReminders: true,
    weeklyReports: false,
  });
  const [security, setSecurity] = useState({
    currentPassword: '••••••••',
    newPassword: '',
    confirmPassword: '',
  });
  const [system, setSystem] = useState({
    academicYear: '2025-2026',
    semester: 'Second Semester',
    maintenanceMode: false,
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage system settings and preferences</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-primary" />
              <CardTitle>Profile Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="staffName">Staff Name</Label>
                <Input
                  id="staffName"
                  value={profile.name}
                  onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <Label htmlFor="staffEmail">Email</Label>
                <Input
                  id="staffEmail"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter your email"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="staffPosition">Position</Label>
                <Input
                  id="staffPosition"
                  value={profile.position}
                  onChange={(e) => setProfile(prev => ({ ...prev, position: e.target.value }))}
                  placeholder="e.g., Nurse, Doctor"
                />
              </div>
              <div>
                <Label htmlFor="staffPhone">Phone Number</Label>
                <Input
                  id="staffPhone"
                  value={profile.phone}
                  onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Contact number"
                />
              </div>
            </div>
            <Button>Save Profile</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-primary" />
              <CardTitle>Notification Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive email alerts for new submissions
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={notifications.emailAlerts}
                  onChange={(e) => setNotifications(prev => ({ ...prev, emailAlerts: e.target.checked }))}
                />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Pending Review Reminders</p>
                <p className="text-sm text-muted-foreground">
                  Daily reminder for pending submissions
                </p>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={notifications.pendingReminders}
                onChange={(e) => setNotifications(prev => ({ ...prev, pendingReminders: e.target.checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Weekly Reports</p>
                <p className="text-sm text-muted-foreground">
                  Receive weekly summary reports
                </p>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={notifications.weeklyReports}
                onChange={(e) => setNotifications(prev => ({ ...prev, weeklyReports: e.target.checked }))}
              />
            </div>
            <Button>Save Notification Preferences</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle>Security Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={security.currentPassword}
                onChange={(e) => setSecurity(prev => ({ ...prev, currentPassword: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={security.newPassword}
                onChange={(e) => setSecurity(prev => ({ ...prev, newPassword: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={security.confirmPassword}
                onChange={(e) => setSecurity(prev => ({ ...prev, confirmPassword: e.target.value }))}
              />
            </div>
            <Button>Change Password</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <SettingsIcon className="w-5 h-5 text-primary" />
              <CardTitle>System Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="academicYear">Current Academic Year</Label>
              <Input
                id="academicYear"
                value={system.academicYear}
                onChange={(e) => setSystem(prev => ({ ...prev, academicYear: e.target.value }))}
                placeholder="e.g., 2023-2024"
              />
            </div>
            <div>
              <Label htmlFor="semester">Current Semester</Label>
              <select
                id="semester"
                className="w-full px-3 py-2 border rounded-md"
                value={system.semester}
                onChange={(e) => setSystem(prev => ({ ...prev, semester: e.target.value }))}
              >
                <option>First Semester</option>
                <option>Second Semester</option>
                <option>Summer</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Maintenance Mode</p>
                <p className="text-sm text-muted-foreground">
                  Disable student submissions temporarily
                </p>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={system.maintenanceMode}
                onChange={(e) => setSystem(prev => ({ ...prev, maintenanceMode: e.target.checked }))}
              />
            </div>
            <Button>Save System Settings</Button>
          </CardContent>
        </Card>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="font-medium mb-2">Export All Data</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Download all medical records and submissions
                </p>
                <Button variant="outline">Export Data</Button>
              </div>
              <div className="border-t pt-4">
                <p className="font-medium mb-2 text-destructive">Clear All Data</p>
                <p className="text-sm text-muted-foreground mb-4">
                  This will permanently delete all submissions and records
                </p>
                <Button variant="destructive">Clear All Data</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
