import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Plus, Search, Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { getStaffUsers } from '../../lib/api';

const statusTone = (status: string) => {
  if (status === 'Active') {
    return 'bg-green-100 text-green-700';
  }
  return 'bg-yellow-100 text-yellow-700';
};

export default function AdminStaffManagement() {
  const [staffList, setStaffList] = useState<any[]>([]);

  useEffect(() => {
    getStaffUsers()
      .then((data) => setStaffList(data.staff || []))
      .catch((error) => {
        console.error('Error loading staff:', error);
        toast.error('Failed to load staff directory');
      });
  }, []);

  const exportToPDF = () => {
    window.print();
  };

  const exportToCSV = () => {
    try {
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Staff ID,Name,Role,Status,Email\n";
      
      staffList.forEach(staff => {
        csvContent += `${staff.id},${staff.name},${staff.role},${staff.status},${staff.email}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `staff_directory_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Staff directory exported successfully");
    } catch (e) {
      toast.error("Failed to export staff list");
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-2">Clinic Staff Management</h1>
          <p className="text-muted-foreground">Manage staff roles, access, and availability</p>
        </div>
        <Button className="self-start md:self-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Staff
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff Directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input className="pl-9" placeholder="Search by name, role, or ID" />
            </div>
            <div className="flex gap-2 print:hidden text-muted-foreground">
              <Button variant="outline" size="sm" onClick={exportToPDF}>
                <Printer className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffList.map((staff) => (
                <TableRow key={staff.id}>
                  <TableCell className="font-medium">{staff.id}</TableCell>
                  <TableCell>{staff.name}</TableCell>
                  <TableCell>{staff.role}</TableCell>
                  <TableCell>
                    <Badge className={statusTone(staff.status)}>{staff.status}</Badge>
                  </TableCell>
                  <TableCell>{staff.email}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">Edit</Button>
                      <Button variant="ghost" size="sm">Deactivate</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
