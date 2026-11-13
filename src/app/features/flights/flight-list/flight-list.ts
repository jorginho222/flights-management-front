import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, effect, inject, Injector, OnInit, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AirportAutocomplete } from '../airport-autocomplete/airport-autocomplete';
import { Airport } from '../data/airport.model';
import { defaultFilters, FlightSearchFilters } from '../data/flight-search.mapper';
import { Flight, flightCode, FLIGHT_STATUSES, FlightStatus } from '../data/flight.model';
import { FlightsStore } from '../data/flights.store';

type StatusTone = 'neutral' | 'success' | 'warning' | 'error';

/** The values that live updates change, each highlighted on its own. */
type LiveField = 'status' | 'departure' | 'arrival' | 'isDelayed';
type LiveValues = Pick<Flight, LiveField>;
const LIVE_FIELDS: readonly LiveField[] = ['status', 'departure', 'arrival', 'isDelayed'];

const sameValue = (field: LiveField, a: LiveValues, b: LiveValues): boolean =>
  field === 'departure' || field === 'arrival'
    ? new Date(a[field]).getTime() === new Date(b[field]).getTime()
    : a[field] === b[field];

const STATUS_TONES: Partial<Record<FlightStatus, StatusTone>> = {
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
    MatTooltipModule,
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './flight-list.html',
  styleUrl: './flight-list.scss',
})
export class FlightList implements OnInit {
  protected readonly store = inject(FlightsStore);
  private readonly injector = inject(Injector);

  protected readonly columns = [
    'code',
    'origin',
    'destination',
    'departure',
    'arrival',
    'punctuality',
    'airline',
    'status',
    'basePrice',
    'actions',
  ];
  protected readonly statuses = FLIGHT_STATUSES;
  protected readonly code = flightCode;

  protected readonly form = new FormGroup({
    origin: new FormControl<Airport | null>(null),
    destination: new FormControl<Airport | null>(null),
    departureFrom: new FormControl<Date | null>(null),
    departureTo: new FormControl<Date | null>(null),
    status: new FormControl<FlightStatus | null>(null),
    isDelayed: new FormControl<boolean | null>(null),
    airlineCode: new FormControl<string | null>(null),
  });

  /**
   * The fields of each flight that changed while shown, highlighted once until their
   * animation ends. Keyed `id:field`.
   */
  protected readonly changed = signal<ReadonlySet<string>>(new Set());
  private shownValues = new Map<string, LiveValues>();

  constructor() {
    // A shown flight only changes through a live update or a reload. The first results of a
    // visit have nothing to compare with, so they never highlight.
    effect(() => {
      const flights = this.store.entities();
      untracked(() => {
        const changed = new Set(this.changed());
        for (const flight of flights) {
          const before = this.shownValues.get(flight.id);
          if (!before) continue;
          for (const field of LIVE_FIELDS) {
            if (!sameValue(field, before, flight)) changed.add(`${flight.id}:${field}`);
          }
        }
        this.shownValues = new Map(
          flights.map(({ id, status, departure, arrival, isDelayed }) => [
            id,
            { status, departure, arrival, isDelayed },
          ]),
        );
        this.changed.set(changed);
      });
    });
  }

  ngOnInit(): void {
    this.store.loadAirlines();
    // The store outlives this screen, so the live connection is tied to the screen instead
    this.store.watchUpdates(this.injector);
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

  protected isChanged(flight: Flight, field: LiveField): boolean {
    return this.changed().has(`${flight.id}:${field}`);
  }

  protected highlighted(flight: Flight, field: LiveField): void {
    const changed = new Set(this.changed());
    changed.delete(`${flight.id}:${field}`);
    this.changed.set(changed);
  }

  protected statusTone(flight: Flight): StatusTone {
    return STATUS_TONES[flight.status] ?? 'neutral';
  }
}
