import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DevicesService, Device } from './devices.service';
import { MatCardModule }   from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule }   from '@angular/material/icon';
import { MatChipsModule }  from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [CommonModule, DatePipe, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressBarModule],
  template: `
    <mat-card>
      <h2 class="page-title">Device Management</h2>

      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
        <button mat-raised-button color="primary" (click)="refresh()">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
        <span class="text-muted" *ngIf="toast()">{{ toast() }}</span>
      </div>

      <mat-progress-bar *ngIf="loading()" mode="indeterminate"></mat-progress-bar>

      <div *ngIf="devices().length === 0 && !loading()" class="text-muted">No devices yet.</div>

      <table *ngIf="devices().length" class="w-full">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Last seen</th>
            <th style="width:320px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let d of devices()">
            <td>{{ d.name }}</td>
            <td>
              <mat-chip [ngClass]="chipClass(d.status)">{{ statusLabel(d.status) }}</mat-chip>
            </td>
            <td>{{ d.lastSeenAt ? (d.lastSeenAt | date:'short') : '—' }}</td>
            <td>
              <button mat-stroked-button color="primary" (click)="reboot(d)" [disabled]="isOffline(d)">
                <mat-icon>restart_alt</mat-icon> Restart
              </button>
              <button mat-stroked-button color="accent" (click)="update(d)" [disabled]="isOffline(d)">
                <mat-icon>system_update</mat-icon> Update
              </button>
              <button mat-stroked-button (click)="runScript(d)" [disabled]="isOffline(d)">
                <mat-icon>terminal</mat-icon> Run Script
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </mat-card>
  `,
  styles: [`.text-muted{color:rgba(0,0,0,.6)}`]
})
export class DevicesComponent {
  private api = inject(DevicesService);
  private destroyRef = inject(DestroyRef);

  devices = signal<Device[]>([]);
  toast   = signal<string | null>(null);
  loading = signal<boolean>(false);

  constructor() {
    this.refresh();
    const t = setInterval(() => this.refresh(), 10_000);
    this.destroyRef.onDestroy(() => clearInterval(t));
  }

  refresh() {
    this.loading.set(true);
    this.api.list().subscribe({
      next: list => { this.devices.set(list); this.loading.set(false); },
      error: err => { this.toast.set(`Load failed: ${err.message || err}`); this.loading.set(false); }
    });
  }

  reboot(d: Device){ this.api.command(d.id,'reboot',{}).subscribe({ next:_=>this.toast.set(`Reboot sent to ${d.name}`)}); }
  update(d: Device){ this.api.command(d.id,'update',{version:'1.0.0'}).subscribe({ next:_=>this.toast.set(`Update queued on ${d.name}`)}); }
  runScript(d: Device){ this.api.command(d.id,'run_script',{scriptId:'collect-logs',args:{minutes:30}}).subscribe({ next:_=>this.toast.set(`Script queued on ${d.name}`)}); }

  statusLabel(s:any){ if(typeof s==='string') return s; return ['Online','Stale','Offline','Blocked'][s] ?? 'Unknown'; }
  chipClass(s:any){
    const l=this.statusLabel(s);
    return {
      'status-chip': true,
      'bg-green-100 text-green-800': l==='Online',
      'bg-yellow-100 text-yellow-800': l==='Stale',
      'bg-red-100 text-red-800': l==='Offline',
      'bg-gray-200 text-gray-800': l==='Blocked',
    };
  }
  isOffline(d:Device){ const l=this.statusLabel(d.status); return l==='Offline'||l==='Blocked'; }
}
