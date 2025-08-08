import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer, switchMap } from 'rxjs';

export interface SensorReading {
  deviceId: string;
  temperature: number;
  humidity: number | null;
  pressure: number | null;
  timestamp: number;              // Unix ms
}

@Injectable({ providedIn: 'root' })
export class ReadingService {
  private http = inject(HttpClient);
  /** Change only this line if your API lives elsewhere */
  private readonly apiUrl = 'http://localhost:5005/readings';

  /** Emits a fresh array every 2 s */
  stream(): Observable<SensorReading[]> {
    return timer(0, 2000).pipe(
      switchMap(() => this.http.get<SensorReading[]>(this.apiUrl))
    );
  }
}
