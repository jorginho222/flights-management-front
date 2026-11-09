import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { translocoTesting } from '../../../core/i18n/transloco-testing';
import { Airport } from '../data/airport.model';
import { AIRPORT_SEARCH_DEBOUNCE_MS } from '../data/airport-search.store';
import { AirportsApi } from '../data/airports-api';
import { ezeiza } from '../testing/flight.fixture';
import { AirportAutocomplete } from './airport-autocomplete';

@Component({
  imports: [AirportAutocomplete],
  template: `<app-airport-autocomplete labelKey="flights.filters.origin" [control]="control" />`,
})
class Host {
  readonly control = new FormControl<Airport | null>(null);
}

describe('AirportAutocomplete', () => {
  let search: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    search = vi.fn(() => of([ezeiza]));
    TestBed.configureTestingModule({
      imports: [Host, translocoTesting()],
      providers: [{ provide: AirportsApi, useValue: { search } }],
    });
  });

  afterEach(() => vi.useRealTimers());

  async function settle(fixture: ComponentFixture<unknown>) {
    await vi.runOnlyPendingTimersAsync();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function typeInto(fixture: ComponentFixture<Host>, text: string) {
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    input.focus();
    input.value = text;
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(AIRPORT_SEARCH_DEBOUNCE_MS);
    await settle(fixture);
    return input;
  }

  it('suggests airports from the server once 3 characters are typed, and picks one', async () => {
    const fixture = TestBed.createComponent(Host);
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Type at least 3 characters');

    await typeInto(fixture, 'ez');
    expect(search).not.toHaveBeenCalled();

    const input = await typeInto(fixture, 'eze');
    expect(search).toHaveBeenCalledWith('eze', 15);
    const option = document.querySelector<HTMLElement>('mat-option')!;
    expect(option.textContent).toContain('EZE Ministro Pistarini International Airport');
    expect(option.textContent).toContain('Ezeiza, Argentina');

    option.click();
    await settle(fixture);
    expect(fixture.componentInstance.control.value).toEqual(ezeiza);
    expect(input.value).toBe('EZE · Ministro Pistarini International Airport');
  });

  it('says when nothing matches', async () => {
    search.mockReturnValue(of([]));
    const fixture = TestBed.createComponent(Host);
    await settle(fixture);
    await typeInto(fixture, 'zzz');
    expect(document.querySelector('mat-option')?.textContent).toContain('No airports match');
  });

  it('clears a picked airport', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.control.setValue(ezeiza);
    await settle(fixture);
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-label="Clear Origin"]')!
      .click();
    expect(fixture.componentInstance.control.value).toBeNull();
  });
});
