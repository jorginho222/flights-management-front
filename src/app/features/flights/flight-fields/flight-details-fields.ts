import { Component, inject, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { airplaneName } from '../../airplanes/data/airplane.model';
import { AirportAutocomplete } from '../airport-autocomplete/airport-autocomplete';
import { FlightsStore } from '../data/flights.store';
import { fieldError, FlightDetailsGroup } from './flight-fields';

/**
 * Airline, airplane, route and price, in their own sections. The airline and airplane
 * options come from `FlightsStore`, which the screen loads.
 */
@Component({
  selector: 'app-flight-details-fields',
  imports: [
    AirportAutocomplete,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  templateUrl: './flight-details-fields.html',
  styleUrl: './flight-fields.scss',
})
export class FlightDetailsFields {
  readonly group = input.required<FlightDetailsGroup>();

  protected readonly store = inject(FlightsStore);
  protected readonly fieldError = fieldError;
  protected readonly airplaneName = airplaneName;
  /** Keeps a selection when the options are reloaded as new objects. */
  protected readonly sameId = (a: { id: string } | null, b: { id: string } | null): boolean =>
    a?.id === b?.id;

  protected loadOptions(): void {
    this.store.loadAirlines();
    this.store.loadAirplanes();
  }

  protected swapRoute(): void {
    const group = this.group();
    const { origin, destination } = group.getRawValue();
    group.patchValue({ origin: destination, destination: origin });
    group.markAsDirty();
  }

  /** Route errors show under the route row, because the autocomplete has no error slot. */
  protected routeError(): string | null {
    const group = this.group();
    const { origin, destination } = group.controls;
    if ((origin.touched && origin.invalid) || (destination.touched && destination.invalid)) {
      return 'validation.required';
    }
    return group.hasError('sameAirports') ? 'flights.form.sameAirports' : null;
  }
}
