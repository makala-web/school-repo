'use client'

import { useState } from 'react'
import { useAppStore, type AppView } from '@/lib/store'
import {
  LayoutDashboard, School, Users, FileText, Settings, MoreHorizontal
} from 'lucide-react'
import { MobileMoreMenu } from './MobileMoreMenu'

// Show only 4 main items + More on bottom nav for mobile
const MOBILE_MENU_ITEMS: { view: AppView; label: string; icon: React.ElementType }[] = [
  { view: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { view: 'classes', label: 'Classes', icon: School },
  { view: 'students', label: 'Students', icon: Users },
  { view: 'reports', label: 'Reports', icon: FileText },
]

export function MobileBottomNav() {
  const { currentView, setView } = useAppStore()
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)

  // Check if current view is in "More" menu
  const isMoreActive = !MOBILE_MENU_ITEMS.some(item => item.view === currentView)

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
        <div className="flex items-center justify-around h-16 pb-safe">
          {MOBILE_MENU_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.view
            return (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 transition-colors active:scale-95 ${
                  isActive
                    ? 'text-emerald-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-emerald-600' : ''}`} />
                <span className="text-[10px] font-medium truncate max-w-full px-1">
                  {item.label}
                </span>
              </button>
            )
          })}
          
          {/* More Button */}
          <button
            onClick={() => setMoreMenuOpen(true)}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 transition-colors active:scale-95 ${
              isMoreActive
                ? 'text-emerald-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <MoreHorizontal className={`w-5 h-5 mb-1 ${isMoreActive ? 'text-emerald-600' : ''}`} />
            <span className="text-[10px] font-medium truncate max-w-full px-1">
              More
            </span>
          </button>
        </div>
      </nav>

      <MobileMoreMenu open={moreMenuOpen} onOpenChange={setMoreMenuOpen} />
    </>
  )
}
