import {
  Component,
  computed,
  effect,
  inject,
  Injector,
  OnInit,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { ApiError } from '../../../core/http/api-error';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog';
import { FLIGHT_CLASSES } from '../../../shared/flight-classes';
import { AirplaneImportDialog } from '../airplane-import/airplane-import-dialog';
import { Airplane, airplaneName } from '../data/airplane.model';
import { AirplanesStore } from '../data/airplanes.store';

@Component({
  selector: 'app-airplane-list',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './airplane-list.html',
  styleUrl: './airplane-list.scss',
})
export class AirplaneList implements OnInit {
  protected readonly store = inject(AirplanesStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);
  private readonly injector = inject(Injector);

  protected readonly columns = ['brand', 'model', 'passengersCapacity', 'seatClasses', 'actions'];
  protected readonly dataSource = new MatTableDataSource<Airplane>();
  protected readonly name = airplaneName;

  /** Exact brand, or '' for all brands. */
  protected readonly brand = signal('');
  /** Part of the model, ignoring case and surrounding spaces. */
  protected readonly model = signal('');
  protected readonly brands = computed(() =>
    [...new Set(this.store.entities().map((airplane) => airplane.brand))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
  );

  private readonly sort = viewChild(MatSort);
  private readonly paginator = viewChild(MatPaginator);

  constructor() {
    this.dataSource.sortingDataAccessor = (airplane, column) => {
      switch (column) {
        case 'passengersCapacity':
          return airplane.passengersCapacity;
        case 'model':
          return airplane.model.toLocaleLowerCase();
        default:
          // Same order as the API: brand, then model
          return airplaneName(airplane).toLocaleLowerCase();
      }
    };

    this.dataSource.filterPredicate = (airplane, filterJson) => {
      const { brand, model } = JSON.parse(filterJson) as { brand: string; model: string };
      return (
        (!brand || airplane.brand === brand) && airplane.model.toLocaleLowerCase().includes(model)
      );
    };

    effect(() => (this.dataSource.data = this.store.entities()));
    effect(() => {
      const filterJson = JSON.stringify({
        brand: this.brand(),
        model: this.model().trim().toLocaleLowerCase(),
      });
      untracked(() => {
        this.dataSource.filter = filterJson;
        this.dataSource.paginator?.firstPage();
      });
    });
    // Deleting the last airplane of the chosen brand leaves no option to show it
    effect(() => {
      const brand = this.brand();
      if (brand && !this.brands().includes(brand)) {
        this.brand.set('');
      }
    });
    effect(() => (this.dataSource.sort = this.sort() ?? null));
    effect(() => (this.dataSource.paginator = this.paginator() ?? null));
  }

  ngOnInit(): void {
    this.store.load();
  }

  protected clearFilters(): void {
    this.brand.set('');
    this.model.set('');
  }

  protected reload(): void {
    this.store.load();
  }

  /** Class names in cabin order, such as "Economy, Business". */
  protected seatClasses(airplane: Airplane): string {
    return FLIGHT_CLASSES.filter((flightClass) =>
      airplane.seatsConfig.some((config) => config.class === flightClass),
    )
      .map((flightClass) => this.transloco.translate(`flightClasses.${flightClass}`))
      .join(', ');
  }

  protected openImport(): void {
    this.dialog
      .open<AirplaneImportDialog, void, number>(AirplaneImportDialog, {
        // The store is provided on the feature route, which the root dialog injector can't see
        injector: this.injector,
        width: '640px',
      })
      .afterClosed()
      // A bare mat-dialog-close (Cancel) closes with '', so only a number means an import ran
      .pipe(filter((imported): imported is number => typeof imported === 'number'))
      .subscribe((imported) => {
        this.notify(this.transloco.translate('airplanes.import.success', { count: imported }));
        this.store.load();
      });
  }

  protected confirmDelete(airplane: Airplane): void {
    const name = airplaneName(airplane);
    const data: ConfirmDialogData = {
      title: this.transloco.translate('airplanes.delete.title'),
      message: this.transloco.translate('airplanes.delete.message', { name }),
      confirmLabel: this.transloco.translate('common.delete'),
    };

    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => this.delete(airplane.id, name));
  }

  private delete(id: string, name: string): void {
    this.store.remove({
      id,
      onSuccess: () => this.notify(this.transloco.translate('airplanes.delete.success', { name })),
      onError: (error: ApiError) =>
        this.notify(error.messages.join(' ') || this.transloco.translate('errors.generic')),
    });
  }

  private notify(message: string): void {
    this.snackBar.open(message, this.transloco.translate('common.dismiss'), { duration: 6000 });
  }
}
