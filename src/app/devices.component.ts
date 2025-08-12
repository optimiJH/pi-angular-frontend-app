import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DevicesService, Device } from './devices.service';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Clipboard } from '@angular/cdk/clipboard';

interface MdnsEntry {
  host: string;
  addresses?: string[];
  port?: number;
  meta?: Record<string, string>;
  lastSeen?: number;
}

/** --- Electron bridge --- */
declare global {
  interface Window {
    discover?: {
      list: () => Promise<any[]>;
      onSnapshot: (h: (p: { at: number; count: number; list: any[] }) => void) => () => void;
    };
    deploy?: {
      run: (p: { ip: string; host?: string; inviteKey: string; serverBase: string; user?: string; password?: string }) =>
        Promise<{ ok: boolean; logs?: string[] }>;
    };
  }
}
class ElectronService {
  readonly isElectron = !!(typeof window !== 'undefined' && window.discover);
  listDiscovered(): Promise<any[]> {
    return this.isElectron && window.discover ? window.discover.list() : Promise.resolve([]);
  }
  onSnapshot(handler: (p: { at: number; count: number; list: any[] }) => void): () => void {
    if (!this.isElectron || !window.discover?.onSnapshot) return () => {};
    return window.discover.onSnapshot(handler);
  }
}

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [
    CommonModule, DatePipe,
    MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressBarModule, MatTooltipModule
  ],
  template: `
    <mat-card>
      <div class="page-title">Device Management</div>

      <div class="toolbar">
        <button mat-raised-button color="primary" (click)="refresh()">
          <mat-icon>refresh</mat-icon> Refresh
        </button>

        <button mat-stroked-button (click)="createInvite()">
          <mat-icon>key</mat-icon> Invite / Approve
        </button>

        <span class="text-muted" *ngIf="toast()">{{ toast() }}</span>
      </div>

      <mat-progress-bar *ngIf="loading()" mode="indeterminate"></mat-progress-bar>
      <div *ngIf="devices().length === 0 && !loading()" class="text-muted">No devices yet.</div>

      <!-- Managed devices -->
      <table *ngIf="devices().length" class="tbl">
        <colgroup>
          <col style="width: 28%">
          <col style="width: 16%">
          <col style="width: 22%">
          <col style="width: 34%">
        </colgroup>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Last seen</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let d of devices()">
            <td class="cell-name">{{ d.name }}</td>
            <td>
              <mat-chip [ngClass]="chipClass(d.status)">{{ statusLabel(d.status) }}</mat-chip>
            </td>
            <td class="cell-time">{{ d.lastSeenAt ? (d.lastSeenAt | date:'short') : '—' }}</td>
            <td class="cell-actions">
              <button mat-stroked-button color="primary" (click)="reboot(d)" [disabled]="!canAct(d)" matTooltip="Restart the device">
                <mat-icon>restart_alt</mat-icon> Restart
              </button>
              <button mat-stroked-button color="accent" (click)="update(d)" [disabled]="!canAct(d)" matTooltip="Trigger update script on device">
                <mat-icon>system_update</mat-icon> Update
              </button>
              <button mat-stroked-button (click)="runScript(d)" [disabled]="!canAct(d)" matTooltip="Run a whitelisted script">
                <mat-icon>terminal</mat-icon> Run Script
              </button>
              <button mat-stroked-button (click)="startReport(d, 60)" [disabled]="!canAct(d)" matTooltip="Start periodic reporting">
                Report Data
              </button>
              <button mat-stroked-button (click)="stopReport(d)" [disabled]="!canAct(d)" matTooltip="Stop periodic reporting">
                Stop Report Data
              </button>
              <button mat-stroked-button (click)="toggleBlock(d)" [color]="isBlocked(d) ? 'accent' : undefined" matTooltip="Block prevents connecting">
                <mat-icon>{{ isBlocked(d) ? 'lock_open' : 'block' }}</mat-icon>
                {{ isBlocked(d) ? 'Unblock' : 'Block' }}
              </button>
              <button mat-stroked-button color="warn" (click)="remove(d)" matTooltip="Remove device and purge commands">
                <mat-icon>delete</mat-icon> Remove
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Invite banner -->
      <div *ngIf="inviteKey()" class="invite-banner">
        <strong>Invite Key:</strong>
        <code class="code">{{ inviteKey() }}</code>
        <button mat-button (click)="copy(inviteKey()!)"><mat-icon>content_copy</mat-icon> Copy</button>
        <span class="text-muted">Expires: {{ inviteExpiry() | date:'short' }}</span>
      </div>

      <!-- Discovered (mDNS) -->
      <div class="mdns" *ngIf="isElectron">
        <h3 class="page-title">Discovered (mDNS)</h3>
        <div *ngIf="discovered().length === 0" class="text-muted">No devices discovered yet…</div>

        <table *ngIf="discovered().length" class="tbl">
          <colgroup>
            <col style="width: 34%">
            <col style="width: 26%">
            <col style="width: 12%">
            <col style="width: 14%">
            <col style="width: 14%">
          </colgroup>
          <thead>
            <tr>
              <th>Host</th>
              <th>IP</th>
              <th>Port</th>
              <th>Info</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let x of discovered()">
              <td class="cell-name">{{ x.host }}</td>
              <td>{{ x.addresses?.[0] || '—' }}</td>
              <td>{{ x.port }}</td>
              <td>{{ x.meta?.['model'] || x.meta?.['name'] || '—' }}</td>
              <td class="cell-actions">
                <button mat-stroked-button (click)="inviteAndShowKey()">
                  <mat-icon>key</mat-icon> Invite
                </button>
                <button mat-stroked-button color="primary" (click)="deploy(x)">
                  <mat-icon>cloud_upload</mat-icon> Deploy
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </mat-card>
  `,
  styles: [`
    .toolbar{display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;}
    .text-muted{color:rgba(255,255,255,.6)}
    .invite-banner{margin-top:12px;padding:10px;border-radius:8px;background:var(--mat-sys-surface-container-high);}
    .code{font-weight:600}

    /* Tables */
    .tbl{width:100%; border-collapse:collapse; table-layout:fixed;}
    .tbl thead th{text-align:left; font-weight:600; padding:10px 8px; border-bottom:1px solid rgba(255,255,255,.12);}
    .tbl tbody td{padding:10px 8px; vertical-align:middle; border-bottom:1px solid rgba(255,255,255,.06);}
    .cell-time{white-space:nowrap; font-variant-numeric:tabular-nums;}
    .cell-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .cell-actions {
      display: flex;
      flex-wrap: wrap;  /* allow wrapping */
      gap: 8px;         /* spacing between buttons */
    }
    .cell-actions > *{
      flex: 0 1 auto;   /* allow button to shrink/wrap naturally */
    }
    .cell-actions > *:last-child{margin-right:0;}
    .mdns{margin-top:16px;}

    /* Chips */
    .status-chip{--pad:4px 10px; padding:var(--pad)}
    .status-online{background:#294a2b; color:#b6f0b9;}
    .status-stale{background:#4a3f29; color:#ffe4a3;}
    .status-offline{background:#3a2d2d; color:#f5bfbf;}
    .status-blocked{background:#2f2f3f; color:#c7c7ff;}
  `]
})
export class DevicesComponent {
  private api = inject(DevicesService);
  private destroyRef = inject(DestroyRef);
  private clipboard = inject(Clipboard);
  private electron = new ElectronService();

  devices = signal<Device[]>([]);
  toast   = signal<string | null>(null);
  loading = signal<boolean>(false);

  inviteKey  = signal<string | null>(null);
  inviteExpiry = signal<string | null>(null);

  discovered = signal<MdnsEntry[]>([]);
  get isElectron(){ return this.electron.isElectron; }

  // Debug (kept but hidden)
  lastSnapshotAt = signal<number | null>(null);
  lastSnapshotCount = signal<number>(0);
  lastSnapshotJson = signal<string>('');

  constructor(){
    this.refresh();
    const t = setInterval(() => this.refresh(), 10_000);
    this.destroyRef.onDestroy(() => clearInterval(t));

    if (this.isElectron){
      const unsub = this.electron.onSnapshot((p) => {
        this.lastSnapshotAt.set(p.at);
        this.lastSnapshotCount.set(p.count);
        this.discovered.set(p.list || []);
        try{ this.lastSnapshotJson.set(JSON.stringify(p.list || [], null, 2)); }catch{}
      });
      this.destroyRef.onDestroy(() => unsub?.());
      this.loadDiscovered();
      const d = setInterval(() => this.loadDiscovered(), 3000);
      this.destroyRef.onDestroy(() => clearInterval(d));
    }
  }

  async loadDiscovered(){
    const list = await this.electron.listDiscovered();
    this.discovered.set(list);
    try{ this.lastSnapshotJson.set(JSON.stringify(list, null, 2)); }catch{}
    this.lastSnapshotAt.set(Date.now());
    this.lastSnapshotCount.set(list.length);
  }

  pollOnce(){ this.loadDiscovered(); }
  clearSnap(){ this.lastSnapshotJson.set(''); this.lastSnapshotAt.set(null); this.lastSnapshotCount.set(0); }

  refresh(){
    this.loading.set(true);
    this.api.list().subscribe({
      next: list => { this.devices.set(list); this.loading.set(false); },
      error: err => { this.toast.set(`Load failed: ${err.message || err}`); this.loading.set(false); }
    });
  }

  // Actions
  reboot(d: Device){ this.api.command(d.id,'reboot',{}).subscribe({ next:_=>this.toast.set(`Reboot sent to ${d.name}`) }); }
  update(d: Device){ this.api.command(d.id,'update',{version:'1.0.0'}).subscribe({ next:_=>this.toast.set(`Update queued on ${d.name}`) }); }
  runScript(d: Device){ this.api.command(d.id,'run_script',{scriptId:'collect-logs',args:{minutes:30}}).subscribe({ next:_=>this.toast.set(`Script queued on ${d.name}`) }); }

  startReport(d: Device, periodSeconds=60){
    this.api.command(d.id,'start_report',{periodSeconds}).subscribe({ next:()=>{}, error:e=>console.error(e) });
  }
  stopReport(d: Device){
    this.api.command(d.id,'stop_report',{}).subscribe({ next:()=>{}, error:e=>console.error(e) });
  }

  remove(d: Device){
    this.api.remove(d.id).subscribe({
      next:_=>{ this.toast.set(`Removed ${d.name}`); this.refresh(); },
      error:e=> this.toast.set(`Remove failed: ${e.message || e}`)
    });
  }

  toggleBlock(d: Device){
    (this.isBlocked(d) ? this.api.unblock(d.id) : this.api.block(d.id)).subscribe({
      next:_=>{ this.toast.set(`${this.isBlocked(d) ? 'Unblocked' : 'Blocked'} ${d.name}`); this.refresh(); },
      error:e=> this.toast.set(`Block/unblock failed: ${e.message || e}`)
    });
  }

  createInvite(){
    this.api.invite().subscribe({
      next: ({enrollmentKey, expiresAt}) => {
        this.inviteKey.set(enrollmentKey);
        this.inviteExpiry.set(expiresAt);
        this.toast.set('Invite created');
      },
      error: e => this.toast.set(`Invite failed: ${e.message || e}`)
    });
  }
  inviteAndShowKey(){ this.createInvite(); }

  async deploy(x: MdnsEntry){
    if (!this.isElectron || !window.deploy?.run){
      this.toast.set('Deploy is only available in the desktop app'); return;
    }
    const ipv4Re = /^(?:\d{1,3}\.){3}\d{1,3}$/;
    const addrs = Array.isArray(x.addresses) ? x.addresses : [];
    const ip = addrs.find(a => ipv4Re.test(a)) ?? addrs[0];
    if (!ip){ this.toast.set('No IPv4 address found for this host'); return; }

    const invite = await new Promise<{enrollmentKey: string, expiresAt?: string}>((res, rej) =>
      this.api.invite().subscribe({ next: res, error: rej })
    );

    const serverBase = 'http://localhost:5005';
    this.toast.set(`Deploying to ${ip}…`);
    try{
      await window.deploy.run({ ip, host: x.host, inviteKey: invite.enrollmentKey, serverBase, user: 'pi', password: 'raspberry' });
      this.toast.set('Deploy OK — waiting for agent heartbeat…');
      setTimeout(() => this.refresh(), 4000);
    }catch(e:any){
      this.toast.set(`Deploy failed: ${e?.message || e}`);
    }
  }

  copy(t: string){ this.clipboard.copy(t); this.toast.set('Copied invite key'); }

  // Status helpers
  statusLabel(s: any){ if (typeof s === 'string') return s; return ['Online','Stale','Offline','Blocked'][s] ?? 'Unknown'; }
  isOffline(d: Device){ const l = this.statusLabel(d.status); return l==='Offline'||l==='Blocked'; }
  isBlocked(d: Device){ return this.statusLabel(d.status)==='Blocked'; }
  canAct(d: Device){ return !this.isOffline(d); }

  chipClass(s:any){
    const l=this.statusLabel(s);
    return {
      'status-chip': true,
      'status-online':  l==='Online',
      'status-stale':   l==='Stale',
      'status-offline': l==='Offline',
      'status-blocked': l==='Blocked',
    };
  }
}
