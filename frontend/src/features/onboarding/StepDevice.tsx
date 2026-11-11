import React, { useState } from 'react';
import { useSyncStore } from '../../store/sync';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { CheckCircle2, Laptop } from 'lucide-react';

export interface StepDeviceProps {
  onComplete: () => void;
  isCompleted: boolean;
}

export const StepDevice: React.FC<StepDeviceProps> = ({ onComplete, isCompleted }) => {
  const thisDevice = useSyncStore((s) => s.thisDevice);
  const renameDevice = useSyncStore((s) => s.renameDevice);
  const [deviceName, setDeviceName] = useState(thisDevice?.name || 'MacBook Pro');

  const handleSave = async () => {
    if (deviceName.trim()) {
      await renameDevice(deviceName.trim());
    }
    onComplete();
  };

  return (
    <div className="flex flex-col gap-3 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Laptop className="w-5 h-5 text-[var(--anchor-accent)]" />
          <h4 className="text-sm font-semibold text-[var(--anchor-text)]">
            3. Name this device
          </h4>
        </div>
        {isCompleted && (
          <span className="flex items-center gap-1 text-xs text-[var(--anchor-ok)] font-medium">
            <CheckCircle2 className="w-4 h-4" /> Configured
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--anchor-text-muted)] leading-relaxed">
        The device that creates a session becomes its <strong className="text-[var(--anchor-warn)]">parent source</strong>. Only the parent source controls whether a session is synced and may delete it from Google Drive.
      </p>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="e.g. Work MacBook Pro, Home Desktop"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={handleSave}>
          Confirm Name
        </Button>
      </div>
    </div>
  );
};
