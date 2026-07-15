import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
  standalone: true,
  template: `
    <header class="text-white py-4 mb-4" style="background: linear-gradient(135deg, #004d26 0%, #006837 100%); box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <div class="container d-flex flex-wrap justify-content-between align-items-center">
        <div>
          <h1 class="h3 fw-bold mb-0">Detector de Manos</h1>
          <p class="mb-0 text-white-50 small">Clasificador MobileNet • Inteligencia Artificial</p>
        </div>
        <div class="bg-white rounded p-2 mt-2 mt-sm-0" style="opacity: 0.95;">
          <span class="text-dark fw-bold small">🤖 IA Inferencia</span>
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {}
