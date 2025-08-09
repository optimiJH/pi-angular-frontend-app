/*****************************************************************
 * src/app/readings-table.component.ts
 *****************************************************************/
import { Component, inject } from '@angular/core';
import {
  AsyncPipe,
  DatePipe,
  DecimalPipe         // <-- gives us the |number pipe
} from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { ReadingService, SensorReading } from './reading.service';
import { Observable, startWith } from 'rxjs';

@Component({
  selector: 'app-readings-table',
  standalone: true,
  /* 👉 NO NgForOf here, but we do add DecimalPipe */
  imports: [MatTableModule, AsyncPipe, DatePipe, DecimalPipe],
  template: `

    <!-- (data$ | async)!  : non-null assertion keeps mat-table happy -->
    <table mat-table [dataSource]="(data$ | async)!">

      <!-- Device -->
      <ng-container matColumnDef="device">
        <th mat-header-cell *matHeaderCellDef>Device</th>
        <td mat-cell *matCellDef="let r">{{ r.deviceId }}</td>
      </ng-container>

      <!-- Temperature -->
      <ng-container matColumnDef="temp">
        <th mat-header-cell *matHeaderCellDef>°C</th>
        <td mat-cell *matCellDef="let r">
          {{ r.temperature | number:'1.1-1' }}
        </td>
      </ng-container>

      <!-- Humidity -->
      <ng-container matColumnDef="hum">
        <th mat-header-cell *matHeaderCellDef>%RH</th>
        <td mat-cell *matCellDef="let r">
          {{ r.humidity === null ? '—' : (r.humidity | number:'1.0-0') }}
        </td>
      </ng-container>

      <!-- Pressure -->
      <ng-container matColumnDef="pres">
        <th mat-header-cell *matHeaderCellDef>hPa</th>
        <td mat-cell *matCellDef="let r">
          {{ r.pressure === null ? '—' : (r.pressure | number:'1.0-0') }}
        </td>
      </ng-container>

      <!-- Timestamp -->
      <ng-container matColumnDef="time">
        <th mat-header-cell *matHeaderCellDef>Time</th>
        <td mat-cell *matCellDef="let r">{{ r.timestamp | date:'mediumTime' }}</td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row        *matRowDef="let row; columns: cols;"></tr>
    </table>
  `,
  styles: [`
    .title {
      margin: 0 0 1rem;
      font-size: 1.5rem;
    }
    table {
      width: 100%;
    }
  `]
})
export class ReadingsTableComponent {

  private service = inject(ReadingService);

  /** Always emits an array (starts empty) so mat-table never gets null */
  readonly data$: Observable<SensorReading[]> =
    this.service.stream().pipe(startWith([] as SensorReading[]));

  readonly cols = ['device', 'temp', 'hum', 'pres', 'time'];
}
