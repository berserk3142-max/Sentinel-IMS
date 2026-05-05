import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function formatMTTR(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'P0': return 'text-red-500';
    case 'P1': return 'text-orange-500';
    case 'P2': return 'text-yellow-500';
    default: return 'text-zinc-400';
  }
}

export function severityBgColor(severity: string): string {
  switch (severity) {
    case 'P0': return 'bg-red-500/10 border-red-500/30 text-red-400';
    case 'P1': return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
    case 'P2': return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
    default: return 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400';
  }
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'OPEN': return 'status-open';
    case 'INVESTIGATING': return 'status-investigating';
    case 'RESOLVED': return 'status-resolved';
    case 'CLOSED': return 'status-closed';
    default: return '';
  }
}
