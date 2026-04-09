// src/app/(auth)/layout.tsx
import AppLayout from '@/components/AppLayout'

export default function AppLayoutWrapper({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return <AppLayout>{children}</AppLayout>
}