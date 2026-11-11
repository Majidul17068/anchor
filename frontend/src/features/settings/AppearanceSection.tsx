import React from 'react';
import { useSettingsStore, type ThemeMode, type Density, type FontSize } from '../../store/settings';
import { Select } from '../../components/Select';
import { Moon, Palette, Sun } from 'lucide-react';

export const AppearanceSection: React.FC = () => {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const density = useSettingsStore((s) => s.density);
  const setDensity = useSettingsStore((s) => s.setDensity);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);

  return (
    <div className="p-5 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-2xl text-left space-y-4 shadow-xs">
      <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--anchor-border-subtle)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] flex items-center justify-center text-[var(--anchor-accent)]">
          <Palette className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--anchor-text)]">
            Appearance & Typography
          </h3>
          <p className="text-xs text-[var(--anchor-text-muted)]">
            Customize window theme, interface density, and text scale.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <label className="text-xs font-medium text-[var(--anchor-text-muted)] block mb-1">
            Color Theme
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                theme === 'dark'
                  ? 'bg-[var(--anchor-surface-sunken)] text-[var(--anchor-accent)] border-[var(--anchor-accent)] shadow-xs font-bold'
                  : 'bg-[var(--anchor-surface)] text-[var(--anchor-text-subtle)] border-[var(--anchor-border)]'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark (Default)</span>
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'bg-[var(--anchor-surface-sunken)] text-[var(--anchor-accent)] border-[var(--anchor-accent)] shadow-xs font-bold'
                  : 'bg-[var(--anchor-surface)] text-[var(--anchor-text-subtle)] border-[var(--anchor-border)]'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </button>
          </div>
        </div>

        <Select
          label="Interface Density"
          value={density}
          onChange={(e) => setDensity(e.target.value as Density)}
          options={[
            { value: 'compact', label: 'Compact (Native Desktop)' },
            { value: 'comfortable', label: 'Comfortable' },
          ]}
        />

        <Select
          label="Font Scale"
          value={fontSize}
          onChange={(e) => setFontSize(e.target.value as FontSize)}
          options={[
            { value: 'small', label: 'Small (11px / 12px)' },
            { value: 'medium', label: 'Medium (Inter Standard)' },
            { value: 'large', label: 'Large (14px base)' },
          ]}
        />
      </div>
    </div>
  );
};
