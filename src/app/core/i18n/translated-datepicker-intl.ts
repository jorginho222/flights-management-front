import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDatepickerIntl } from '@angular/material/datepicker';
import { TranslocoService } from '@jsverse/transloco';

/** Routes the Material datepicker's built-in English labels through Transloco. */
@Injectable()
export class TranslatedDatepickerIntl extends MatDatepickerIntl {
  private readonly transloco = inject(TranslocoService);

  constructor() {
    super();
    this.transloco.events$.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => {
      this.applyLabels();
      this.changes.next();
    });
    this.applyLabels();
  }

  private applyLabels(): void {
    const t = (key: string) => this.transloco.translate(`datepicker.${key}`);
    this.calendarLabel = t('calendar');
    this.openCalendarLabel = t('openCalendar');
    this.closeCalendarLabel = t('closeCalendar');
    this.prevMonthLabel = t('prevMonth');
    this.nextMonthLabel = t('nextMonth');
    this.prevYearLabel = t('prevYear');
    this.nextYearLabel = t('nextYear');
    this.prevMultiYearLabel = t('prevMultiYear');
    this.nextMultiYearLabel = t('nextMultiYear');
    this.switchToMonthViewLabel = t('switchToMonthView');
    this.switchToMultiYearViewLabel = t('switchToMultiYearView');
    this.startDateLabel = t('startDate');
    this.endDateLabel = t('endDate');
  }
}
