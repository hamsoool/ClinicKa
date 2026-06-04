import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { LogoutBlockedError, useAuth } from '../lib/auth';
import { Button } from './ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

type SettingsLogoutCardProps = {
  className?: string;
};

export default function SettingsLogoutCard({
  className,
}: SettingsLogoutCardProps) {
  const navigate = useNavigate();
  const { logout, pendingStaffClearanceCount } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      if (error instanceof LogoutBlockedError) {
        setConfirmOpen(false);
        setBlockedOpen(true);
        return;
      }

      toast.error(error instanceof Error ? error.message : 'Unable to log out right now.');
    }
  };

  return (
    <>
      <div className={className}>
        <Button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="w-full bg-rose-700 text-white hover:bg-rose-800 sm:w-auto"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of your account?</AlertDialogTitle>
            <AlertDialogDescription>
              Any unsaved changes on this page will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleSignOut();
              }}
              className="bg-primary text-white hover:bg-primary/90"
            >
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blockedOpen} onOpenChange={setBlockedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Background clearance still in progress</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStaffClearanceCount > 1
                ? `${pendingStaffClearanceCount} medical clearances are still being processed in the background. Please wait until they finish before logging out.`
                : 'A medical clearance is still being processed in the background. Please wait until it finishes before logging out.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setBlockedOpen(false)}
              className="bg-primary text-white hover:bg-primary/90"
            >
              I Understand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
