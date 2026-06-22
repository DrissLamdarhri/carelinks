import { Colors } from './colors';

export type ServiceTheme = {
  primary: string;
  surface: string;
  surfaceStrong: string;
  inputBorder: string;
  badgeBg: string;
};

export function isKineService(serviceKey?: string | null | undefined): boolean {
  if (!serviceKey) return false;
  const s = String(serviceKey).toLowerCase();
  return s === 'kine' || s.includes('kine') || s.includes('kiné') || s.includes('physio') || s.includes('physiotherapy');
}

export function getServiceTheme(serviceKey?: string | null | undefined): ServiceTheme {
  const isKine = isKineService(serviceKey);

  if (isKine) {
    // Kiné theme (green)
    return {
      primary: '#065F46', // deep green
      surface: '#F0FDF4', // very light green surface
      surfaceStrong: '#ECFDF5',
      inputBorder: '#D1FAE5',
      badgeBg: '#D1FAE5',
    };
  }

  // Default patient/nurse theme (blue/orange accents kept in Colors)
  return {
    primary: Colors.primary || '#0D0870',
    surface: Colors.surfaceWarm || '#EDE5CC',
    surfaceStrong: '#FFF7ED',
    inputBorder: Colors.border || '#E7E6E0',
    badgeBg: '#FFF1E6',
  };
}
