import { Component, computed, inject, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { Airport, airportLabel, isAirport } from '../data/airport.model';
import { AIRPORT_SEARCH_MIN_LENGTH } from '../data/airports-api';
import { AirportSearchStore } from '../data/airport-search.store';

/**
 * An airport field that searches the API as the user types. With requireSelection,
 * the control ends up holding a picked airport or null, never leftover text.
 */
@Component({
  selector: 'app-airport-autocomplete',
  imports: [
    MatAutocompleteModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  providers: [AirportSearchStore],
  templateUrl: './airport-autocomplete.html',
  styleUrl: './airport-autocomplete.scss',
})
export class AirportAutocomplete {
  protected readonly store = inject(AirportSearchStore);

  readonly control = input.required<FormControl<Airport | null>>();
  /** Translation key of the field label. */
  readonly labelKey = input.required<string>();

  protected readonly minLength = AIRPORT_SEARCH_MIN_LENGTH;
  protected readonly noMatches = computed(
    () =>
      !this.store.loading() &&
      this.store.searchedTerm() !== null &&
      this.store.options().length === 0,
  );

  protected readonly display = (value: Airport | string | null): string =>
    isAirport(value) ? airportLabel(value) : (value ?? '');

  /** Such as "Ezeiza, Argentina". */
  protected subtitle(airport: Airport): string {
    return [airport.city, airport.countryName].filter(Boolean).join(', ');
  }

  protected hasValue(): boolean {
    return isAirport(this.control().value);
  }

  protected clear(): void {
    this.control().setValue(null);
    this.store.search('');
  }
}
