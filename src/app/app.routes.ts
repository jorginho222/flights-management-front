import { Routes } from '@angular/router';
import { AdminLayout } from './layout/admin-layout/admin-layout';

export const routes: Routes = [
  {
    path: '',
    component: AdminLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'airlines' },
      {
        path: 'airlines',
        loadChildren: () =>
          import('./features/airlines/airlines.routes').then((m) => m.AIRLINES_ROUTES),
      },
      {
        path: 'airplanes',
        loadChildren: () =>
          import('./features/airplanes/airplanes.routes').then((m) => m.AIRPLANES_ROUTES),
      },
      {
        path: 'flights',
        loadChildren: () =>
          import('./features/flights/flights.routes').then((m) => m.FLIGHTS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
