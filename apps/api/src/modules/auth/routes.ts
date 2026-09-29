import { Router, Request, Response } from 'express';
import { signToken, authMiddleware, AuthRequest } from '../../core/auth';
import { successResponse, errorResponse, UserRole } from '@polar-ops/shared';
import { nowISO } from '../../core/clock';

const router = Router();

const DEMO_PERSONAS = [
  {
    id: 'usr-admin-01',
    name: 'Dr. S. K. Roy',
    email: 'operations@ncpor.res.in',
    role: 'ADMIN' as UserRole,
    title: 'Director of Polar Operations, NCPOR Goa'
  },
  {
    id: 'usr-logistics-01',
    name: 'Commander R. V. Raman',
    email: 'logistics@ncpor.res.in',
    role: 'LOGISTICS_OFFICER' as UserRole,
    title: 'Antarctic Logistics & Cargo Coordinator'
  },
  {
    id: 'usr-station-01',
    name: 'Col. Vikram Rathore',
    email: 'leader.bharati@ncpor.res.in',
    role: 'STATION_LEADER' as UserRole,
    title: 'Station Leader, Bharati Station'
  },
  {
    id: 'usr-sci-01',
    name: 'Dr. Priya Sengupta',
    email: 'priya.sengupta@ncpor.res.in',
    role: 'SCIENTIST' as UserRole,
    title: 'Principal Investigator (Glaciology)'
  }
];

router.get('/demo-users', (req: Request, res: Response) => {
  res.json(successResponse(DEMO_PERSONAS, { simulatedDate: nowISO() }));
});

router.post('/login', (req: Request, res: Response) => {
  const { email } = req.body;
  const user = DEMO_PERSONAS.find(p => p.email.toLowerCase() === email?.toLowerCase()) || DEMO_PERSONAS[0];

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name
  });

  res.json(successResponse({ token, user }, { simulatedDate: nowISO() }));
});

router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  res.json(successResponse(req.user, { simulatedDate: nowISO() }));
});

export default router;
