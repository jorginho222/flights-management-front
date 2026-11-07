import { Routes } from '@angular/router';
import { provideNativeDateAdapter } from '@angular/material/core';
import { FlightsStore } from './data/flights.store';

export const FLIGHTS_ROUTES: Routes = [
  {
    path: '',
    providers: [FlightsStore, provideNativeDateAdapter()],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./flight-list/flight-list').then((m) => m.FlightList),
      },
    ],
  },
];
