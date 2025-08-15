// src/app/telemetry.component.ts
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { MatProgressBarModule } from '@angular/material/progress-bar';

type Row = { timestamp: number; temperature: number };

@Component({
  selector: 'app-telemetry',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective, MatProgressBarModule],
  providers: [provideEchartsCore({ echarts: () => import('echarts') })],
  template: `
    <div class="page-title">Live Telemetry</div>

    <mat-progress-bar *ngIf="loading()" mode="indeterminate"></mat-progress-bar>

    <div *ngIf="!loading() && !hasData()" class="muted">No data yet.</div>

    <div class="chart" echarts [options]="opt" *ngIf="hasData()"></div>
  `,
  styles: [`
    .chart{height:340px;width:100%}
    .muted{color:rgba(0,0,0,.6)}
  `]
})
export class TelemetryComponent {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(true);
  opt: any = {};

  ngOnInit() {
    this.load();
    const t = setInterval(() => this.load(), 10_000);
    this.destroyRef.onDestroy(() => clearInterval(t));
  }

  hasData(): boolean {
    return Array.isArray(this.opt?.series?.[0]?.data) && this.opt.series[0].data.length > 0;
  }

  private load() {
    this.loading.set(true);
    this.http.get<any[]>('http://localhost:5005/readings').subscribe({
      next: rows => { this.setChart(rows as Row[]); this.loading.set(false); },
      error: _ => { this.setChart([]); this.loading.set(false); }
    });
  }

  private setChart(rows: Row[]) {
    const data = (rows || [])
      .filter(r => typeof r.temperature === 'number' && typeof r.timestamp === 'number')
      .sort((a,b) => a.timestamp - b.timestamp)
      .map(r => [r.timestamp, Number(r.temperature.toFixed(2))]);

    this.opt = {
      animation: false,
      grid: { left: 48, right: 18, top: 24, bottom: 40 },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v: number) => `${v} °C`
      },
      xAxis: { type: 'time' },
      yAxis: { type: 'value', name: '°C' },
      series: [{
        type: 'line',
        name: 'Temperature',
        data,
        showSymbol: false,
        smooth: true
      }]
    };
  }
}
