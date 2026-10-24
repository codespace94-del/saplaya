import type { ReactNode } from 'react';
import { Shell } from '@/components/admin/Shell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
