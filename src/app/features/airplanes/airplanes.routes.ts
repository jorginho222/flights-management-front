import { Routes } from '@angular/router';
import { AirplanesStore } from './data/airplanes.store';

export const AIRPLANES_ROUTES: Routes = [
  {
    path: '',
    providers: [AirplanesStore],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./airplane-list/airplane-list').then((m) => m.AirplaneList),
      },
      {
        path: 'new',
        loadComponent: () => import('./airplane-form/airplane-form').then((m) => m.AirplaneForm),
      },
      {
        path: ':id/edit',
        loadComponent: () => import('./airplane-form/airplane-form').then((m) => m.AirplaneForm),
      },
    ],
  },
];
