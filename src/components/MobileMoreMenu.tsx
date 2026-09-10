'use client'

import { useAppStore, type AppView } from '@/lib/store'
import {
  GraduationCap,
  BookOpen,
  CalendarDays,
  CalendarCheck,
  UserCog,
  MessageSquare,
  Activity,
  Heart,
  HardDrive,
  FileText,
  MoreHorizontal,
  X
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

// Additional menu items that appear in "More" sheet
const MORE_MENU_ITEMS: { view: AppView; label: string; icon: React.ElementType }[] = [
  { view: 'exams', label: 'Exams', icon: GraduationCap },
  { view: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { view: 'subjects', label: 'Subjects', icon: BookOpen },
  { view: 'marks', label: 'Marks', icon: CalendarDays },
  { view: 'tabia', label: 'Tabia', icon: Heart },
  { view: 'reports', label: 'Reports', icon: FileText },
  { view: 'sms', label: 'SMS', icon: MessageSquare },
  { view: 'diagnostics', label: 'Diagnostics', icon: Activity },
  { view: 'settings', label: 'Settings', icon: UserCog },
  { view: 'backup', label: 'Backup', icon: HardDrive },
]

interface MobileMoreMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileMoreMenu({ open, onOpenChange }: MobileMoreMenuProps) {
  const { currentView, setView } = useAppStore()

  const handleViewChange = (view: AppView) => {
    setView(view)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[82vh] mobile-sheet overflow-hidden">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-lg font-semibold flex items-center gap-2">
            <MoreHorizontal className="w-5 h-5 text-emerald-600" />
            More Options
          </SheetTitle>
        </SheetHeader>
        <div className="max-h-[58vh] overflow-y-auto custom-scrollbar pr-1">
        <div className="grid grid-cols-3 gap-3 py-6">
          {MORE_MENU_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.view
            return (
              <button
                key={item.view}
                onClick={() => handleViewChange(item.view)}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all active:scale-95 ${
                  isActive
                    ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                    : 'bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                <div className={`p-2 rounded-lg ${isActive ? 'bg-emerald-200' : 'bg-white'}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
        </div>
        <div className="flex justify-center pb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-gray-500"
          >
            <X className="w-4 h-4 mr-1" />
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
