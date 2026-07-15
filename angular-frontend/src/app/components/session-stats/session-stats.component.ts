import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface HistoryItem {
  time: string;
  source: string;
  classification: string;
  confidence: number;
}

@Component({
  selector: 'app-session-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-stats.component.html',
  styles: [`
    .list-group-item {
      transition: background-color 0.2s ease;
    }
    .list-group-item:hover {
      background-color: #f8fafc;
    }
  `]
})
export class SessionStatsComponent {
  @Input() processedCount = 0;
  @Input() lastConfidence = '-';
  @Input() history: HistoryItem[] = [];
}
