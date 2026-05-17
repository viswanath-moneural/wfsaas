import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = {
  name: string
  value: string
  options: Parameters<NextResponse['cookies']['set']>[2]
}

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/invite',
  '/privacy',
  '/api/webhook',         // WhatsApp webhook — always public
  '/api/auth/callback',
]

const MODULE_ROUTE_MAP: Record<string, string> = {
  '/sales/customers': 'customers',
  '/sales/orders': 'sales_orders',
  '/sales/invoices': 'invoices',
  '/sales/dispatch': 'dispatch_orders',
  '/sales/returns': 'sales_returns',
  '/sales/payments': 'customer_payments',
  '/purchases/vendors': 'vendors',
  '/purchases/orders': 'purchase_orders',
  '/purchases/grn': 'goods_receipt',
  '/purchases/returns': 'purchase_returns',
  '/purchases/payments': 'vendor_payments',
  '/manufacturing/work-orders': 'work_orders',
  '/manufacturing/production-runs': 'production_runs',
  '/manufacturing/machines': 'machines',
  '/manufacturing/bom': 'bill_of_materials',
  '/manufacturing/quality': 'quality_checks',
  '/inventory/movements': 'stock_movements',
  '/inventory/adjustments': 'stock_adjustments',
  '/inventory/warehouses': 'warehouses',
  '/crm/leads': 'leads',
  '/crm/opportunities': 'opportunities',
  '/crm/quotes': 'quotes',
  '/crm/parties': 'parties',
  '/crm/interactions': 'interactions',
  '/hr/employees': 'employees',
  '/hr/attendance': 'attendance',
  '/hr/payroll': 'payroll',
}

function moduleForPath(pathname: string) {
  const match = Object.entries(MODULE_ROUTE_MAP).find(([path]) => pathname === path || pathname.startsWith(`${path}/`))
  return match?.[1] ?? null
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route))
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — required for Server Components
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Allow public routes through
  if (isPublicRoute(pathname)) {
    // Redirect logged-in users away from auth pages
    if (user && (pathname === '/login' || pathname === '/register')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Protect all other routes
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  const moduleKey = moduleForPath(pathname)
  if (moduleKey) {
    const { data: appUser } = await supabase
      .from('users')
      .select('org_id, role')
      .eq('id', user.id)
      .maybeSingle()
    const role = String(appUser?.role ?? '').toLowerCase()
    const bypass = role === 'superadmin' || role === 'admin'
    if (appUser?.org_id && !bypass) {
      const { data: moduleRow } = await supabase
        .from('org_modules')
        .select('is_enabled')
        .eq('org_id', appUser.org_id)
        .eq('module_key', moduleKey)
        .maybeSingle()
      if (!moduleRow?.is_enabled) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
