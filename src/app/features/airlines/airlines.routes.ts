import { Routes } from '@angular/router';
import { AirlinesStore } from './data/airlines.store';

export const AIRLINES_ROUTES: Routes = [
  {
    path: '',
    providers: [AirlinesStore],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./airline-list/airline-list').then((m) => m.AirlineList),
      },
      {
        path: 'new',
        loadComponent: () => import('./airline-form/airline-form').then((m) => m.AirlineForm),
      },
      {
        path: ':id/edit',
        loadComponent: () => import('./airline-form/airline-form').then((m) => m.AirlineForm),
      },
    ],
  },
];
