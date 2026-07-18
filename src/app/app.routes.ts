import { Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { PlaygroundPage } from './pages/playground/playground.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'playground', component: PlaygroundPage },
  { path: '**', redirectTo: '' },
];
