import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { TranslocoPipe } from '@jsverse/transloco';
import { AirportAutocomplete } from '../airport-autocomplete/airport-autocomplete';
import { Airport } from '../data/airport.model';
import { defaultFilters, FlightSearchFilters } from '../data/flight-search.mapper';
import { Flight, flightCode, FLIGHT_STATUSES, FlightStatus } from '../data/flight.model';
import { FlightsStore } from '../data/flights.store';

type StatusTone = 'neutral' | 'success' | 'warning' | 'error';

const STATUS_TONES: Partial<Record<FlightStatus, StatusTone>> = {
  advanced: 'warning',
  delayed: 'warning',
  gateChanged: 'warning',
  diverted: 'error',
  cancelled: 'error',
  landed: 'success',
  arrived: 'success',
};

@Component({
  selector: 'app-flight-list',
  imports: [
    AirportAutocomplete,
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatDatepickerModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  templateUrl: './flight-list.html',
  styleUrl: './flight-list.scss',
})
export class FlightList implements OnInit {
  protected readonly store = inject(FlightsStore);

  protected readonly columns = [
    'code',
    'origin',
    'destination',
    'departure',
    'arrival',
    'airline',
    'status',
    'basePrice',
  ];
  protected readonly statuses = FLIGHT_STATUSES;
  protected readonly code = flightCode;

  protected readonly form = new FormGroup({
    origin: new FormControl<Airport | null>(null),
    destination: new FormControl<Airport | null>(null),
    departureFrom: new FormControl<Date | null>(null),
    departureTo: new FormControl<Date | null>(null),
    status: new FormControl<FlightStatus | null>(null),
    airlineCode: new FormControl<string | null>(null),
  });

  ngOnInit(): void {
    this.store.loadAirlines();
    // The store outlives the screen: reopening it shows the last search again
    const saved = this.store.filters();
    if (saved) {
      this.form.reset(saved);
      this.store.reload();
    } else {
      this.reset();
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.store.search(this.form.getRawValue() as FlightSearchFilters);
  }

  /** Back to the default search: upcoming flights. */
  protected reset(): void {
    this.form.reset(defaultFilters());
    this.store.search(this.form.getRawValue() as FlightSearchFilters);
  }

  protected swapRoute(): void {
    const { origin, destination } = this.form.getRawValue();
    this.form.patchValue({ origin: destination, destination: origin });
  }

  protected onPage(event: PageEvent): void {
    this.store.goToPage(event.pageIndex + 1, event.pageSize);
  }

  protected statusTone(flight: Flight): StatusTone {
    return STATUS_TONES[flight.status] ?? 'neutral';
  }
}
