'use client'

import { createContext, useContext, useCallback, useState, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id:       string
  type:     ToastType
  title:    string
  message?: string
  duration: number
}

interface ToastContextValue {
  toasts:  Toast[]
  toast:   (opts: Omit<Toast, 'id'>) => void
  success: (title: string, message?: string) => void
  error:   (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info:    (title: string, message?: string) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    const newToast: Toast = { duration: 4000, ...opts, id }  // fixed: default first, id last
    setToasts(prev => [...prev, newToast])
    setTimeout(() => dismiss(id), newToast.duration)
  }, [dismiss])

  const success = useCallback((title: string, message?: string) =>
    toast({ type: 'success', title, message, duration: 3500 }), [toast])

  const error = useCallback((title: string, message?: string) =>
    toast({ type: 'error', title, message, duration: 6000 }), [toast])

  const warning = useCallback((title: string, message?: string) =>
    toast({ type: 'warning', title, message, duration: 4500 }), [toast])

  const info = useCallback((title: string, message?: string) =>
    toast({ type: 'info', title, message, duration: 4000 }), [toast])

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, warning, info, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}