import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

/**
 * Check if the current user has admin or employee access.
 * Returns { session, isAdmin, isEmployee } or a 401 response.
 *
 * Usage:
 *   const result = await requireStaff()
 *   if (result.response) return result.response
 *   const { session, isAdmin, isEmployee } = result
 */
export async function requireStaff() {
  const session = await auth()
  if (!session) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const role = session.user.role
  if (role !== 'admin' && role !== 'employee') {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return {
    session,
    isAdmin: role === 'admin',
    isEmployee: role === 'employee',
  }
}

/**
 * Check if the current user is an admin (not employee).
 * Returns { session } or a 401 response.
 */
export async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session }
}
